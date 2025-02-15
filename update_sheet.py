import json
import os
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# Carica le credenziali del service account
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
creds = ServiceAccountCredentials.from_json_keyfile_name('credentials.json', scope)
client = gspread.authorize(creds)

# Ottieni l'ID del foglio dal segreto di GitHub
sheet_id = os.environ.get('GOOGLE_SHEET_ID')

# Apri il foglio di lavoro
sheet = client.open_by_key(sheet_id).sheet1

# Carica i dati dal file JSON
with open('data.json', 'r') as file:
    data = json.load(file)

# Prepara l'intestazione se non esiste già
if len(sheet.get_all_values()) == 0:
    headers = list(data.keys())
    sheet.append_row(headers)

# Aggiungi una nuova riga con i valori
row_values = list(data.values())
sheet.append_row(row_values)
