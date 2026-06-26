#!/bin/bash

# Script de build pour Nuru Analytics Premium sous Linux

set -e

echo "============================================="
echo "Construction de l'exécutable Nuru Analytics"
echo "============================================="

# 1. Vérification des dépendances système
echo "Installation des dépendances système requises pour PyWebView sur Linux..."
sudo apt-get update
sudo apt-get install -y build-essential python3-dev \
    libgirepository1.0-dev libcairo2-dev pkg-config python3-gi \
    python3-gi-cairo gir1.2-gtk-3.0 gir1.2-webkit2-4.0

# 2. Construction du frontend React (Vite)
echo "Construction du frontend..."
npm install --legacy-peer-deps
npm run build

# 3. Installation des dépendances Python
echo "Configuration de l'environnement Python..."
pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller

# 4. Compilation avec PyInstaller
echo "Création de l'exécutable standalone avec PyInstaller..."
pyinstaller --clean --onefile --noconsole --name "Nuru_Analytics_Premium_Linux" --add-data "dist:dist" main.py

echo "============================================="
echo "Succès ! L'exécutable est disponible dans le dossier 'dist/'."
echo "Pour le lancer : ./dist/Nuru_Analytics_Premium_Linux"
echo "============================================="
