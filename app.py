import streamlit as st
import subprocess
import os
from google import genai
from google.genai import types
from PIL import Image, ImageDraw
import io

# Yol yoksa kontrol
if not os.path.exists("./engine"):
    try:
        subprocess.run(["g++", "-O3", "engine.cpp", "-o", "engine"], check=True)
    except Exception as e:
        print(f"Derleme hatasi: {e}")


# Sayfa ayarları (Ortalanmış sohbet ekranı için 'centered' kullanıyoruz)
st.set_page_config(page_title="SPHEREx Astrofizikçi AI", layout="centered")

# --- Gemini API Başlatma ---
if "GEMINI_API_KEY" in st.secrets:
    client = genai.Client(api_key=st.secrets["GEMINI_API_KEY"])
    MODEL_ID = "gemini-2.5-flash" 
else:
    client = None

# --- ARAYÜZ TASARIMI ---
st.title("SPHEREx Astrofizikçi AI")
st.markdown("Gökyüzü, ötegezegenler, SPHEREx misyonu ve astrofizik hakkında merak ettiğiniz her şeyi sorabilirsiniz.")

if not client:
    st.error("Gemini API anahtarı bulunamadı. Lütfen Streamlit Secrets kısmına `GEMINI_API_KEY` ekleyin.")
    st.stop() # API yoksa uygulamayı burada durdur.

# --- SOHBET GEÇMİŞİNİ TUTMA ---
if "messages" not in st.session_state:
    st.session_state.messages = []

# Önceki mesajları ekrana bas
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# --- KULLANICI GİRDİSİ VE YAPAY ZEKA YANITI ---
if prompt := st.chat_input("Bir soru sorun..."):
    # 1. Kullanıcının mesajını geçmişe ekle ve göster
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    
    # 2. Yapay zekanın yanıtını al ve göster
    with st.chat_message("assistant"):
        with st.spinner("Düşünüyor..."):
            try:
                # Gemini'ye isteği gönder
                response = client.models.generate_content(
                    model=MODEL_ID,
                    contents=prompt
                )
                # Yanıtı ekrana bas
                st.markdown(response.text)
                # Yanıtı geçmişe ekle
                st.session_state.messages.append({"role": "assistant", "content": response.text})
            except Exception as e:
                st.error(f"Bir hata oluştu: {e}")