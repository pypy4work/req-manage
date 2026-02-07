#!/usr/bin/env python3
"""
Seed Egypt geography tables using GeoNames data.
Outputs SQL for Postgres into scripts/seed_geodata_eg.sql
"""

import csv
import io
import re
import sys
import zipfile
from urllib.request import urlopen

ADMIN1_URL = "https://download.geonames.org/export/dump/admin1CodesASCII.txt"
ADMIN2_URL = "https://download.geonames.org/export/dump/admin2Codes.txt"
EG_ZIP_URL = "https://download.geonames.org/export/dump/EG.zip"

OUT_PATH = "scripts/seed_geodata_eg.sql"

def download(url: str) -> bytes:
    with urlopen(url) as r:
        return r.read()

def esc(value: str) -> str:
    return value.replace("'", "''")

def to_float(v: str):
    try:
        return float(v)
    except Exception:
        return None

def to_int(v: str):
    try:
        return int(v)
    except Exception:
        return None

def main():
    print("Downloading GeoNames datasets...")
    admin1_txt = download(ADMIN1_URL).decode("utf-8")
    admin2_txt = download(ADMIN2_URL).decode("utf-8")
    eg_zip = download(EG_ZIP_URL)

    with zipfile.ZipFile(io.BytesIO(eg_zip)) as zf:
        eg_txt = zf.read("EG.txt").decode("utf-8")

    # Parse admin1 codes (governorates)
    gov_ar = {
        'Cairo': 'القاهرة', 'Alexandria': 'الإسكندرية', 'Port Said': 'بورسعيد',
        'Suez': 'السويس', 'Damietta': 'دمياط', 'Dakahlia': 'الدقهلية',
        'Sharqia': 'الشرقية', 'Qalyubia': 'القليوبية', 'Kafr el-Sheikh': 'كفر الشيخ',
        'Gharbia': 'الغربية', 'Monufia': 'المنوفية', 'Beheira': 'البحيرة',
        'Ismailia': 'الإسماعيلية', 'Giza': 'الجيزة', 'Beni Suweif': 'بني سويف',
        'Faiyum': 'الفيوم', 'Minya': 'المنيا', 'Asyut': 'أسيوط',
        'Sohag': 'سوهاج', 'Qena': 'قنا', 'Aswan': 'أسوان', 'Luxor': 'الأقصر',
        'Red Sea': 'البحر الأحمر', 'New Valley': 'الوادي الجديد',
        'Matruh': 'مطروح', 'North Sinai': 'شمال سيناء', 'South Sinai': 'جنوب سيناء'
    }

    admin1 = {}
    for line in admin1_txt.splitlines():
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        code, name, asciiname, geoname_id = parts[0], parts[1], parts[2], parts[3]
        if not code.startswith("EG."):
            continue
        admin1_code = code.split(".")[1]
        en_name = asciiname or name
        admin1[admin1_code] = {
            "code": admin1_code,
            "name_en": en_name,
            "name_ar": gov_ar.get(en_name, en_name),
            "geoname_id": to_int(geoname_id)
        }

    # Parse admin2 codes (centers)
    cities_ar = {
        'Heliopolis': 'مصر الجديدة', 'Nasr City': 'مدينة نصر', 'Maadi': 'المعادي',
        'Helwan': 'حلوان', 'Giza': 'الجيزة', 'Dokki': 'الدقي',
        '6th of October': '6 أكتوبر', 'Sheikh Zayed': 'الشيخ زايد',
        'Borg El Arab': 'برج العرب', 'Suez': 'السويس', 'Ismailia': 'الإسماعيلية',
        'Port Said': 'بورسعيد', 'Arish': 'العريش', 'Sharm El Sheikh': 'شرم الشيخ',
        'Mit Ghamr': 'ميت غمر', 'Dikirnis': 'دكرنس', 'Bilqas': 'بلقاس',
        'Manzilah': 'المنزلة', 'Mansurah': 'المنصورة', 'Aja': 'أجا',
        'Damanhur': 'دمنهور', 'Kafr ad Dawwar': 'كفر الدوار', 'Rashid': 'رشيد',
        'Edku': 'إدكو', 'Tanta': 'طنطا', 'Zifta': 'زفتى', 'Mahallah al Kubra': 'المحلة الكبرى',
        'Kafr el-Sheikh': 'كفر الشيخ', 'Minya': 'المنيا', 'Asyut': 'أسيوط',
        'Sohag': 'سوهاج', 'Qena': 'قنا', 'Aswan': 'أسوان', 'Luxor': 'الأقصر'
    }

    def get_ar_name(en_name: str) -> str:
        # Strip common prefixes for better matching
        clean_name = re.sub(r'^(Markaz|Qism|Center of)\s+', '', en_name, flags=re.IGNORECASE).strip()
        # Common variations in GeoNames
        clean_name = clean_name.replace('`', '').replace("'", "")
        if clean_name in cities_ar:
            return cities_ar[clean_name]
        return en_name

    admin2 = {}
    for line in admin2_txt.splitlines():
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        code, name, asciiname, geoname_id = parts[0], parts[1], parts[2], parts[3]
        if not code.startswith("EG."):
            continue
        _, a1, a2 = code.split(".", 2)
        admin2_code = f"{a1}.{a2}"
        en_name = asciiname or name
        admin2[admin2_code] = {
            "admin1": a1,
            "admin2": a2,
            "code": admin2_code,
            "name_en": en_name,
            "name_ar": get_ar_name(en_name),
            "geoname_id": to_int(geoname_id)
        }

    # Parse EG.txt for ADM1/ADM2 lat/long and populated places
    adm1_geo = {}
    adm2_geo = {}
    cities = []
    villages = []
    neighborhoods = []

    reader = csv.reader(io.StringIO(eg_txt), delimiter="\t")
    for row in reader:
        if len(row) < 19:
            continue
        geoname_id = to_int(row[0])
        name = row[1]
        asciiname = row[2]
        lat = to_float(row[4])
        lon = to_float(row[5])
        feature_class = row[6]
        feature_code = row[7]
        country = row[8]
        admin1_code = row[10]
        admin2_code = row[11]
        population = to_int(row[14]) or 0

        if country != "EG":
            continue

        if feature_code == "ADM1":
            adm1_geo[admin1_code] = {"lat": lat, "lon": lon, "geoname_id": geoname_id}
            continue
        if feature_code == "ADM2":
            adm2_geo[f"{admin1_code}.{admin2_code}"] = {"lat": lat, "lon": lon, "geoname_id": geoname_id}
            continue

        if feature_class != "P":
            continue

        record = {
            "geoname_id": geoname_id,
            "name_en": asciiname or name,
            "name_ar": asciiname or name,
            "admin1": admin1_code,
            "admin2": admin2_code,
            "lat": lat,
            "lon": lon,
            "population": population,
            "feature_code": feature_code
        }

        if feature_code in {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"}:
            cities.append(record)
        elif feature_code == "PPL":
            villages.append(record)
        elif feature_code == "PPLX":
            neighborhoods.append(record)

    # Write SQL
    print(f"Writing SQL to {OUT_PATH} ...")
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("-- Auto-generated from GeoNames (EG) data\n")
        f.write("BEGIN;\n")
        f.write("TRUNCATE TABLE sca.neighborhoods, sca.villages, sca.cities, sca.centers, sca.governorates RESTART IDENTITY CASCADE;\n\n")

        # Governorates
        for code, g in sorted(admin1.items(), key=lambda x: x[0]):
            geo = adm1_geo.get(code, {})
            f.write(
                "INSERT INTO sca.governorates (name_ar, name_en, code, geoname_id, latitude, longitude) "
                f"VALUES ('{esc(g['name_ar'])}', '{esc(g['name_en'])}', '{esc(code)}', "
                f"{g['geoname_id'] or 'NULL'}, {geo.get('lat', 'NULL')}, {geo.get('lon', 'NULL')});\n"
            )

        f.write("\n")

        # Centers (admin2)
        for code, c in sorted(admin2.items(), key=lambda x: x[0]):
            geo = adm2_geo.get(code, {})
            f.write(
                "INSERT INTO sca.centers (governorate_id, name_ar, name_en, geoname_id, latitude, longitude) "
                f"VALUES ((SELECT governorate_id FROM sca.governorates WHERE code = '{esc(c['admin1'])}'), "
                f"'{esc(c['name_ar'])}', '{esc(c['name_en'])}', {c['geoname_id'] or 'NULL'}, "
                f"{geo.get('lat', 'NULL')}, {geo.get('lon', 'NULL')});\n"
            )

        f.write("\n")

        # Cities
        for city in cities:
            center_key = f"{city['admin1']}.{city['admin2']}"
            center_geo_id = adm2_geo.get(center_key, {}).get("geoname_id")
            center_geo_sql = center_geo_id if center_geo_id is not None else "NULL"
            f.write(
                "INSERT INTO sca.cities (governorate_id, center_id, name_ar, name_en, geoname_id, population, latitude, longitude) "
                f"VALUES ((SELECT governorate_id FROM sca.governorates WHERE code = '{esc(city['admin1'])}'), "
                f"(SELECT center_id FROM sca.centers WHERE geoname_id = {center_geo_sql} LIMIT 1), "
                f"'{esc(city['name_ar'])}', '{esc(city['name_en'])}', {city['geoname_id'] or 'NULL'}, "
                f"{city['population'] or 0}, {city['lat'] if city['lat'] is not None else 'NULL'}, {city['lon'] if city['lon'] is not None else 'NULL'});\n"
            )

        f.write("\n")

        # Villages
        for v in villages:
            center_key = f"{v['admin1']}.{v['admin2']}"
            center_geo_id = adm2_geo.get(center_key, {}).get("geoname_id")
            center_geo_sql = center_geo_id if center_geo_id is not None else "NULL"
            f.write(
                "INSERT INTO sca.villages (center_id, name_ar, name_en, geoname_id, population, latitude, longitude) "
                f"VALUES ((SELECT center_id FROM sca.centers WHERE geoname_id = {center_geo_sql} LIMIT 1), "
                f"'{esc(v['name_ar'])}', '{esc(v['name_en'])}', {v['geoname_id'] or 'NULL'}, "
                f"{v['population'] or 0}, {v['lat'] if v['lat'] is not None else 'NULL'}, {v['lon'] if v['lon'] is not None else 'NULL'});\n"
            )

        f.write("\n")

        # Neighborhoods (no reliable parent mapping without extra datasets)
        for n in neighborhoods:
            f.write(
                "INSERT INTO sca.neighborhoods (city_id, name_ar, name_en, geoname_id, latitude, longitude) "
                f"VALUES (NULL, "
                f"'{esc(n['name_ar'])}', '{esc(n['name_en'])}', {n['geoname_id'] or 'NULL'}, "
                f"{n['lat'] if n['lat'] is not None else 'NULL'}, {n['lon'] if n['lon'] is not None else 'NULL'});\n"
            )

        f.write("COMMIT;\n")

    print("Done.")

if __name__ == "__main__":
    main()
