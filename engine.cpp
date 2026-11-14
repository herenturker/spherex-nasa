/*
   Copyright 2026 Habil Eren Türker, Esila Ekinci, İrem Temizel

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

// Dosya: engine.cpp

// KÜTÜPHANELER
#include <iostream>
#include <vector>
#include <cmath>
#include <string>
#include <fstream>
#include <queue>

using Satir = std::vector<double>; // Satırları temsil eden bir vektör tipi

// STRUCTS

// ---

struct Matris
{
    std::vector<Satir> satirlar; // Matrisin satırlarını tutan vektör
    int satir_sayisi;
    int sutun_sayisi;

    Matris(int sa_sayisi, int su_sayisi)
    { // Constructor
        satir_sayisi = sa_sayisi;
        sutun_sayisi = su_sayisi;

        satirlar.resize(satir_sayisi, Satir(sutun_sayisi, 0.0));
    }

    // Köşeli parantezleri [] matris gibi kullanmamızı sağlayacak
    // Bu sayede matris[0][1] = 5.0; yazabileceğiz
    Satir &operator[](int satir_index)
    {
        return satirlar[satir_index];
    }

    // (Okuma yaparken kullanılacak versiyonu)
    const Satir &operator[](int satir_index) const
    {
        return satirlar[satir_index];
    }
};

// ---

struct AdayCisim
{
    int x;                  // aday cismin x koordinatı
    int y;                  // aday cismin y koordinatı
    float toplam_parlaklik; // aday cismin toplam parlaklık değeri
    int piksel_boyutu;
};

// ---

// FONKSİYON PROTOTİPLERİ

Matris dosyadan_oku(const std::string &dosya_yolu); // Dosyadan matris okur ve Matris tipinde döndürür.

void fark_al(const Matris &m1, const Matris &m2, Matris &fark_matrisi); // Fark_Piksel = |Eski_Piksel - Yeni_Piksel|

void esikleme_uygula(Matris &fark_matrisi, float esik_degeri); // Fark matrisine eşikleme uygular.
// Belirli bir eşik değerinin altındaki farkları sıfırlar.
// Eğer Fark_Piksel < Eşik_Değeri ise, Fark_Piksel = 0 yap. Burada ternary operatorü kullanabilirsin. (?:)

std::vector<AdayCisim> kumeleri_bul(const Matris &fark_matrisi); // Fark matrisindeki kümeleri bulur ve AdayCisim tipinde bir vektör döndürür.
// Fark tablosunda 0'dan büyük kalan pikselleri bul. Yan yana (yatay, dikey, çapraz) komşu olan pikselleri tek bir "Grup" altında topla.

/*
Temel mantık:
    X_Merkez = (Tüm X'lerin Toplamı) / (Piksel Sayısı)

    Y_Merkez = (Tüm Y'lerin Toplamı) / (Piksel Sayısı)

    Toplam_Parlaklık = Piksel1 + Piksel2 + ...
*/

// main (Burayı değiştirmene gerek yok, Python ile iletişim burada sağlanıyor)
int main(int argc, char *argv[])
{
    // Python bize 3 argüman gönderecek:
    // argv[1] = eski_goruntu.txt
    // argv[2] = yeni_goruntu.txt
    // argv[3] = esik_degeri (örn: "50.0")

    if (argc < 4)
    {
        std::cerr << "Hata: Eksik arguman. Kullanim: ./engine <eski.txt> <yeni.txt> <esik>\n";
        return 1;
    }

    std::string yol_eski = argv[1];
    std::string yol_yeni = argv[2];
    float esik = std::stof(argv[3]);

    // 1. Dosyaları oku
    Matris m_eski = dosyadan_oku(yol_eski);
    Matris m_yeni = dosyadan_oku(yol_yeni);

    // 2. Fark matrisini oluştur
    Matris fark_matrisi(m_eski.satir_sayisi, m_eski.sutun_sayisi);
    fark_al(m_eski, m_yeni, fark_matrisi);

    // 3. Eşikleme uygula
    esikleme_uygula(fark_matrisi, esik);

    // 4. Kümeleri bul
    std::vector<AdayCisim> adaylar = kumeleri_bul(fark_matrisi);

    // 5. Python'un okuyacağı formatta çıktı ver
    if (adaylar.empty())
    {
        std::cout << "TESPIT_YOK\n";
    }
    else
    {
        for (const auto &aday : adaylar)
        {
            std::cout << "TESPIT_EDILDI|X:" << aday.x
                      << "|Y:" << aday.y
                      << "|PARLAKLIK:" << aday.toplam_parlaklik
                      << "|BOYUT:" << aday.piksel_boyutu << "\n";
        }
    }

    return 0;
}

// ------ DOLDURULACAK YERLER ------

// 1. DOSYADAN OKUMA
Matris dosyadan_oku(const std::string &dosya_yolu)
{
    // TODO 1: std::ifstream ile dosya_yolu'nu aç.
    // TODO 2: Dosyadaki satır ve sütun sayısını dinamik olarak hesapla.
    // TODO 3: Hesapladığın boyutlarda Matris nesnesi oluştur (Matris mat(satir, sutun);).
    // TODO 4: İç içe for döngüleriyle dosyadaki double değerleri oku ve mat[i][j]'ye ata.
    // TODO 5: mat nesnesini return et.

    // Geçici test dönüşü (Bunu silip kendi kodunu yaz):
    Matris mat(10, 10);
    return mat;
}

// 2. FARK ALMA
void fark_al(const Matris &m1, const Matris &m2, Matris &fark_matrisi)
{
    // TODO 1: İç içe for döngüleri aç (satir ve sutun için).
    // TODO 2: Her piksel için std::abs(m1[i][j] - m2[i][j]) hesapla.
    // TODO 3: Çıkan sonucu fark_matrisi[i][j]'ye yaz.
}

// 3. EŞİKLEME (THRESHOLDING)
void esikleme_uygula(Matris &fark_matrisi, float esik_degeri)
{
    // TODO 1: İç içe for döngüleri aç.
    // TODO 2: Eğer fark_matrisi[i][j] < esik_degeri ise, o hücreyi 0.0 yap.
    // İpucu: fark_matrisi[i][j] = (fark_matrisi[i][j] < esik_degeri) ? 0.0 : fark_matrisi[i][j];
}

// 4. KÜMELEME VE MERKEZ BULMA (BFS ALGORİTMASI)
std::vector<AdayCisim> kumeleri_bul(const Matris &fark_matrisi)
{
    std::vector<AdayCisim> adaylar;

    // TODO 1: Ziyaret edilen pikselleri tutmak için 2D bool vektörü oluştur (başlangıçta false).
    // TODO 2: Tüm matrisi tara. Eğer piksel > 0.0 ve ziyaret edilmemişse BFS başlat.
    // TODO 3: BFS için std::queue kullan. Başlangıç pikselini kuyruğa at.
    // TODO 4: Kuyruk boşalana kadar komşu (8 yönlü: yatay, dikey, çapraz) pikselleri kontrol et.
    // TODO 5: Eğer komşu piksel > 0.0 ve ziyaret edilmemişse kuyruğa at ve ziyaret edildi işaretle.
    // TODO 6: Aynı gruptaki piksellerin X, Y toplamlarını ve toplam parlaklığı hesapla.
    // TODO 7: Grup bittiğinde:
    //         - X_merkez = X_toplam / piksel_sayisi
    //         - Y_merkez = Y_toplam / piksel_sayisi
    //         - Bir AdayCisim struct'ı oluşturup adaylar vektörüne ekle.

    return adaylar; // Bulduğun cisimleri döndür.
}