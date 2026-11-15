import streamlit as st
import subprocess
import os
import numpy as np
import pandas as pd
import json
from PIL import Image
from google import genai

# PAGE CONFIGURATION
st.set_page_config(page_title="SPHEREx Analysis Lab", layout="wide")

st.markdown("""
<style>
    /* Dark Space Theme */
    .stApp {
        background-color: #0B0E14;
        color: #E2E8F0;
    }
    h1, h2, h3 {
        color: #00D2FF !important;
        font-family: 'Inter', sans-serif;
    }
    .stButton>button {
        background-color: #9D4EDD;
        color: white;
        border-radius: 8px;
        border: none;
        padding: 10px 24px;
        font-weight: bold;
        transition: 0.3s;
    }
    .stButton>button:hover {
        background-color: #7B2CBF;
        box-shadow: 0 0 15px #9D4EDD;
    }
    .stSlider>div>div>div>div {
        background-color: #00D2FF;
    }
    .metric-card {
        background-color: #141A24;
        border: 1px solid #2A2F3A;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    }
</style>
""", unsafe_allow_html=True)

# BACKEND SETUP (C++ Compilation & Gemini)
if not os.path.exists("./engine"):
    try:
        subprocess.run(["g++", "-O3", "engine.cpp", "-o", "engine"], check=True)
    except Exception as e:
        st.error(f"C++ Engine Compilation Error: {e}")

if "GEMINI_API_KEY" in st.secrets:
    client = genai.Client(api_key=st.secrets["GEMINI_API_KEY"])
    MODEL_ID = "gemini-3.5-flash" 
else:
    st.error("Missing GEMINI_API_KEY in Streamlit Secrets.")
    st.stop()

def image_to_matrix_file(image_file, filename):
    """Converts uploaded image to a grayscale matrix and saves it as a .txt file for the C++ engine."""
    img = Image.open(image_file).convert('L')
    # Resize to match a standardized matrix size  for quick C++ processing
    img = img.resize((117, 117))  # Resize to 117x117 for consistency
    matrix = np.array(img, dtype=float)
    np.savetxt(filename, matrix)
    return filename

# ==========================================
# USER INTERFACE
# ==========================================
st.title("🛰️ SPHEREx Sky Change Laboratory")
st.markdown("Compare multi-epoch infrared observations, run C++ edge-detection algorithms, and generate AI-driven scientific reports.")

col1, col2 = st.columns([1, 2])

with col1:
    st.markdown("<div class='metric-card'>", unsafe_allow_html=True)
    st.subheader("1. Observation Inputs")
    
    img_old = st.file_uploader("Upload Observation A (Old)", type=["png", "jpg", "jpeg"])
    img_new = st.file_uploader("Upload Observation B (New)", type=["png", "jpg", "jpeg"])
    
    st.subheader("2. Scientific Data (Optional)")
    data_file = st.file_uploader("Upload Spectral Data (CSV/JSON)", type=["csv", "json"])
    
    st.subheader("3. Engine Parameters")
    threshold = st.slider("C++ Noise Threshold", min_value=10, max_value=255, value=50, 
                          help="Pixels with differences below this threshold are discarded as noise.")
    
    run_btn = st.button("Execute Analysis Pipeline", use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

with col2:
    st.markdown("<div class='metric-card'>", unsafe_allow_html=True)
    st.subheader("Analysis Results & AI Interpretation")
    
    if run_btn:
        if not img_old or not img_new:
            st.warning("Please upload both Observation A and Observation B to run the analysis.")
        else:
            with st.spinner("Converting images to scientific matrices..."):
                file_old = image_to_matrix_file(img_old, "temp_old.txt")
                file_new = image_to_matrix_file(img_new, "temp_new.txt")
            
            with st.spinner(f"Running C++ Engine (Threshold: {threshold})..."):
                try:
                    # Execute C++ Engine
                    result = subprocess.run(
                        ["./engine", file_old, file_new, str(threshold)],
                        capture_output=True, text=True, check=True
                    )
                    engine_output = result.stdout.strip()
                    
                    if "TESPIT_YOK" in engine_output or not engine_output:
                        st.info("C++ Engine Result: No significant celestial changes detected above the threshold.")
                        engine_summary = "No moving objects detected."
                    else:
                        st.success(f"C++ Engine Result:\n{engine_output}")
                        engine_summary = engine_output
                        
                    # Process Data File (if provided)
                    data_summary = "No supplementary spectral data provided."
                    if data_file:
                        if data_file.name.endswith('.csv'):
                            df = pd.read_csv(data_file)
                            data_summary = df.head(10).to_string() # Pass first 10 rows to AI to save context
                        elif data_file.name.endswith('.json'):
                            data_summary = json.dumps(json.load(data_file), indent=2)[:1000] # Pass first 1000 chars
                        st.info("Supplementary data successfully loaded and sent to AI.")

                    # Clean up temp files
                    os.remove(file_old)
                    os.remove(file_new)

                except subprocess.CalledProcessError as e:
                    st.error(f"C++ Engine Execution Failed: {e.stderr}")
                    engine_summary = "Engine failed."
                    data_summary = ""

            # --- GEMINI AI ANALYSIS ---
            if engine_summary:
                with st.spinner("Astrophysicist AI is generating a scientific report..."):
                    prompt = f"""
                    You are an expert astrophysicist analyzing SPHEREx telescope data.
                    Your C++ edge-detection engine scanned two images (Observation A and Observation B) and outputted the following:
                    {engine_summary}
                    
                    Additionally, the observer provided this supplementary spectral data:
                    {data_summary}
                    
                    Based on this information, write a concise, professional scientific report. 
                    Address: What could this detected object be (e.g., asteroid, Kuiper Belt object, noise artifact)? 
                    Does the spectral data support this hypothesis? 
                    Keep the tone objective and scientific.
                    """
                    
                    try:
                        response = client.models.generate_content(
                            model=MODEL_ID,
                            contents=prompt
                        )
                        st.markdown("### Astro-AI Report:")
                        st.info(response.text)
                    except Exception as e:
                        st.error(f"Gemini API Error: {e}")
    else:
        st.info("Awaiting inputs. Upload images and click 'Execute Analysis Pipeline'.")
    st.markdown("</div>", unsafe_allow_html=True)