import streamlit as st
import subprocess
import os
import numpy as np
import pandas as pd
import json
import io
from fpdf import FPDF
from PIL import Image
from google import genai

st.set_page_config(page_title="SPHEREx Analysis Lab", layout="wide")

st.markdown("""
<style>
    /* Base Application Theme */
    .stApp {
        background-color: #0E1117;
        color: #E2E8F0;
    }
    
    /* Typography */
    h1, h2, h3, h4 {
        color: #F8FAFC !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-weight: 500;
        letter-spacing: -0.02em;
    }
    
    /* Modern Buttons */
    .stButton>button {
        background-color: #1E293B;
        color: #F8FAFC;
        border-radius: 6px;
        border: 1px solid #334155;
        padding: 8px 16px;
        font-weight: 500;
        transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    .stButton>button:hover {
        background-color: #334155;
        border-color: #475569;
        color: #F8FAFC;
    }
    
    /* File Uploader */
    [data-testid="stFileUploadDropzone"] {
        background-color: #0F172A;
        border: 1px dashed #475569;
        color: #CBD5E1;
    }
    
    /* Tabs */
    .stTabs [data-baseweb="tab-list"] {
        gap: 24px;
        border-bottom: 1px solid #334155;
    }
    .stTabs [data-baseweb="tab"] {
        color: #94A3B8;
        padding-bottom: 12px;
    }
    .stTabs [aria-selected="true"] {
        color: #F8FAFC !important;
        border-bottom: 2px solid #3B82F6 !important;
    }
    
    /* Chat Input Styling */
    [data-testid="stChatInput"] {
        border-radius: 12px;
        border: 1px solid #334155;
        background-color: #1E293B;
    }
</style>
""", unsafe_allow_html=True)


if "ai_report" not in st.session_state:
    st.session_state["ai_report"] = None
if "pdf_data" not in st.session_state:
    st.session_state["pdf_data"] = None

if not os.path.exists("./engine"):
    try:
        subprocess.run(["g++", "-O3", "engine.cpp", "-o", "engine"], check=True)
    except Exception as e:
        st.error(f"C++ Engine Compilation Error: {e}")

if "GEMINI_API_KEY" in st.secrets:
    client = genai.Client(api_key=st.secrets["GEMINI_API_KEY"])
    MODEL_ID = "gemini-3.6-flash"
else:
    st.error("Missing GEMINI_API_KEY in Streamlit Secrets.")
    st.stop()

def image_to_matrix_file(image_file, filename):
    """Converts uploaded image to a grayscale matrix and saves it as a .txt file for the C++ engine."""
    img = Image.open(image_file).convert('L')
    img = img.resize((117, 117))
    matrix = np.array(img, dtype=float)
    np.savetxt(filename, matrix)
    return filename

# ==========================================
# USER INTERFACE
# ==========================================
st.title("SPHEREx Sky Change Laboratory")
st.markdown("Compare multi-epoch infrared observations, run C++ edge-detection algorithms, and generate AI-driven scientific reports.")

tab_analysis, tab_chatbot = st.tabs(["Analysis Pipeline", "Scientific AI Chatbot"])

# ------------------------------------------
# TAB 1: ANALYSIS PIPELINE
# ------------------------------------------
with tab_analysis:
    st.subheader("1. Observation Inputs")
    img_old = st.file_uploader("Upload Observation A (Old)", type=["png", "jpg", "jpeg"])
    img_new = st.file_uploader("Upload Observation B (New)", type=["png", "jpg", "jpeg"])
    
    st.subheader("2. Scientific Data (Optional)")
    data_files = st.file_uploader(
        "Upload Spectral Data (CSV/JSON) - Multiple files allowed", 
        type=["csv", "json"], 
        accept_multiple_files=True
    )
    
    st.subheader("3. Engine Parameters")
    threshold = st.slider("C++ Noise Threshold", min_value=10, max_value=255, value=50, 
                          help="Pixels with differences below this threshold are discarded as noise.")
    
    run_btn = st.button("Execute Analysis Pipeline", use_container_width=True)
    
    st.markdown("---")
    st.subheader("Analysis Results & AI Interpretation")
    
    if run_btn:
        # Yeni bir analiz başlatıldığında eski raporu temizle
        st.session_state["ai_report"] = None
        st.session_state["pdf_data"] = None
        
        if not img_old or not img_new:
            st.warning("Please upload both Observation A and Observation B to run the analysis.")
        else:
            with st.spinner("Converting images to scientific matrices..."):
                file_old = image_to_matrix_file(img_old, "temp_old.txt")
                file_new = image_to_matrix_file(img_new, "temp_new.txt")
            
            with st.spinner(f"Running C++ Engine (Threshold: {threshold})..."):
                try:
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
                        
                    data_summary = "No supplementary spectral data provided."
                    if data_files:
                        combined_data = []
                        for df_file in data_files:
                            if df_file.name.endswith('.csv'):
                                df = pd.read_csv(df_file)
                                combined_data.append(f"--- File: {df_file.name} ---\n{df.head(10).to_string()}")
                            elif df_file.name.endswith('.json'):
                                j_data = json.dumps(json.load(df_file), indent=2)
                                combined_data.append(f"--- File: {df_file.name} ---\n{j_data[:1000]}")
                        data_summary = "\n\n".join(combined_data)
                        st.info(f"Loaded {len(data_files)} supplementary data file(s) for AI analysis.")

                    os.remove(file_old)
                    os.remove(file_new)

                except subprocess.CalledProcessError as e:
                    st.error(f"C++ Engine Execution Failed: {e.stderr}")
                    engine_summary = "Engine failed."
                    data_summary = ""

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
                    Keep the tone objective, scientific, and strictly professional.
                    """
                    
                    try:
                        response = client.models.generate_content(
                            model=MODEL_ID,
                            contents=prompt
                        )
                        
                        st.session_state["ai_report"] = response.text
                        pdf = FPDF()
                        pdf.add_page()
                        pdf.set_font("Arial", size=12)
                        safe_text = response.text.encode('latin-1', 'replace').decode('latin-1')
                        pdf.multi_cell(0, 10, txt=safe_text)
                        st.session_state["pdf_data"] = pdf.output(dest='S').encode('latin-1')
                        
                    except Exception as e:
                        st.error(f"Gemini API Error: {e}")

    if st.session_state["ai_report"]:
        st.markdown("### Astro-AI Report:")
        st.info(st.session_state["ai_report"])
        
        st.markdown("#### Export Report")
        dl_col1, dl_col2, dl_col3 = st.columns(3)
        
        with dl_col1:
            st.download_button(
                label="Download as Markdown",
                data=st.session_state["ai_report"],
                file_name="astro_ai_report.md",
                mime="text/markdown",
                use_container_width=True
            )
            
        with dl_col2:
            st.download_button(
                label="Download as TXT",
                data=st.session_state["ai_report"],
                file_name="astro_ai_report.txt",
                mime="text/plain",
                use_container_width=True
            )
            
        with dl_col3:
            if st.session_state["pdf_data"]:
                st.download_button(
                    label="Download as PDF",
                    data=st.session_state["pdf_data"],
                    file_name="astro_ai_report.pdf",
                    mime="application/pdf",
                    use_container_width=True
                )
    elif not run_btn:
        st.info("Awaiting inputs. Upload images and click 'Execute Analysis Pipeline'.")

# ------------------------------------------
# TAB 2: MODERN CHATBOT WITH DATA ANALYSIS
# ------------------------------------------
with tab_chatbot:
    st.subheader("Scientific AI Assistant")
    st.markdown("Query the AI regarding SPHEREx data, astrophysics, or upload context files for direct analysis.")
    
    chat_context_files = st.file_uploader(
        "Upload Context Data for Chat (Optional - CSV/JSON)", 
        type=["csv", "json"], 
        accept_multiple_files=True,
        key="chat_uploader"
    )
    
    if "messages" not in st.session_state:
        st.session_state.messages = []

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("Enter your query..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)
        
        with st.chat_message("assistant"):
            with st.spinner("Processing..."):
                try:
                    full_prompt = prompt
                    
                    if chat_context_files:
                        context_data = []
                        for df_file in chat_context_files:
                            if df_file.name.endswith('.csv'):
                                df = pd.read_csv(df_file)
                                context_data.append(f"File {df_file.name}:\n{df.head(15).to_string()}")
                            elif df_file.name.endswith('.json'):
                                j_data = json.dumps(json.load(df_file), indent=2)
                                context_data.append(f"File {df_file.name}:\n{j_data[:1500]}")
                        
                        if context_data:
                            context_string = "\n\n".join(context_data)
                            full_prompt = f"""
                            Here is some context data uploaded by the user:
                            {context_string}
                            
                            Based on this data and your astrophysics knowledge, answer the following query:
                            {prompt}
                            """
                    
                    response = client.models.generate_content(
                        model=MODEL_ID,
                        contents=full_prompt
                    )
                    
                    st.markdown(response.text)
                    st.session_state.messages.append({"role": "assistant", "content": response.text})
                except Exception as e:
                    st.error(f"Error: {e}")