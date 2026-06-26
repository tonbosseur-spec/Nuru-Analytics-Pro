import os
import json
import base64
import platform
import subprocess
import hashlib
from datetime import datetime
import tkinter as tk
from tkinter import filedialog, messagebox

try:
    from Crypto.PublicKey import RSA
    from Crypto.Signature import pkcs1_15
    from Crypto.Hash import SHA256
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    print("ATTENTION : pycryptodome n'est pas installé. Les licences ne pourront pas être vérifiées.")

# =============================================================================
# VARIABLES GLOBALES ET CLÉ PUBLIQUE
# =============================================================================

# Fichier où la licence sera copiée/enregistrée localement après validation
LICENSE_SAVE_PATH = "nuru_active_license.json"

# Clé publique RSA pour vérifier la signature (Générée par l'équipe Nuru avec la clé privée)
PUBLIC_KEY_DATA = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0NXMIHDXLS2nDDVpoZVp
U5rxbsW6nGlfsmhT47N7cOHxagvZFFr/pKM4g4cO4oZejlweE9BYqcjzLHqfvrRR
Ip1QC2uHqdySnT8E1iM7YHkGyKOlSrWnK/TK9+/ep22803WuXMjZ1xTJR9o9fmNW
l8+FBvJ3fW54Wv8YZ2yLJbkwqrhvrtdjg8wsgi+hIjASCCyjw7TaClBnnR/rbw5P
ax1Yx12If1xRG+ITOd7rmGQmAX+wKJAcN3EVPbHDaI6XR1Yv9Skq5FrkRkFbOyx7
3U4x1YSmL/cxid7xWwju1cl4xG5XoGVrNmPs2QQqWu4ivYEgVcrTX9R6lOoQSntM
yQIDAQAB
-----END PUBLIC KEY-----"""


# =============================================================================
# LOGIQUE DE VÉRIFICATION ET MATÉRIEL
# =============================================================================

def get_hardware_id() -> str:
    """
    Génère un identifiant unique, stable et anonyme de la machine.
    Basé sur le numéro de série de la carte mère ou du CPU.
    Format de sortie : NURU-SYS-XXXX-XXXX
    """
    system = platform.system()
    hw_id = "UNKNOWN"
    
    try:
        if system == "Windows":
            # WMIC permet de récupérer l'identifiant matériel sous Windows (UUID système)
            output = subprocess.check_output("wmic csproduct get uuid", shell=True).decode('utf-8', errors='ignore')
            hw_id = output.strip().split('\n')[-1].strip()
            prefix = "WIN"
        elif system == "Darwin":
            # Sous macOS, on utilise ioreg pour trouver le numéro de série de la carte mère
            output = subprocess.check_output("ioreg -rd1 -c IOPlatformExpertDevice | grep 'IOPlatformSerialNumber'", shell=True).decode('utf-8', errors='ignore')
            hw_id = output.split('"')[-2]
            prefix = "MAC"
        elif system == "Linux":
            # Sous Linux, on accède généralement au fichier dmi
            with open("/sys/class/dmi/id/product_uuid", "r") as f:
                hw_id = f.read().strip()
            prefix = "LIN"
        else:
            import uuid
            hw_id = str(uuid.getnode())
            prefix = "GEN"
    except Exception:
        # Fallback en cas de droits insuffisants ou environnement restrictif
        import uuid
        hw_id = str(uuid.getnode())
        prefix = "UNK"

    # Application d'un hash MD5 pour normaliser et anonymiser la donnée
    # On isole les 8 premiers caractères pour un format lisible.
    short_hash = hashlib.md5(hw_id.encode()).hexdigest().upper()
    return f"NURU-{prefix}-{short_hash[:4]}-{short_hash[4:8]}"


def verify_license(license_file_path: str) -> tuple[bool, str]:
    """
    Vérifie la validité cryptographique et logique d'un fichier de licence.
    
    Le fichier (.lic ou .json) doit contenir :
    - first_name, last_name, hardware_id, expiry_date, signature
    """
    try:
        if not CRYPTO_AVAILABLE:
            return False, "Le module cryptographique (pycryptodome) n'est pas installé sur cet ordinateur. Installez-le avec : pip install pycryptodome"

        if not os.path.exists(license_file_path):
            return False, "Fichier de licence introuvable."
            
        with open(license_file_path, "r", encoding="utf-8") as f:
            lic_data = json.load(f)
            
        # 1. Vérification de l'intégrité de la structure
        required_keys = ["first_name", "last_name", "hardware_id", "expiry_date", "signature"]
        if not all(k in lic_data for k in required_keys):
            return False, "Format de licence invalide ou corrompu (champs manquants)."
            
        signature = base64.b64decode(lic_data.pop("signature"))
        
        # 2. Vérification Cryptographique (Authenticité)
        # On recrée la chaîne JSON sans la signature pour vérifier le Hash
        message = json.dumps(lic_data, sort_keys=True, separators=(',', ':')).encode("utf-8")
        h = SHA256.new(message)
        
        try:
            key = RSA.import_key(PUBLIC_KEY_DATA)
            pkcs1_15.new(key).verify(h, signature)
        except (ValueError, TypeError) as e:
            # L'exception est levée si la signature ne correspond pas au contenu chiffré par la clé privée
            return False, f"ÉCHEC : La signature est invalide ou le fichier a été falsifié. [{str(e)}]"
            
        # 3. Vérification du Hardware (Spécifique à l'ordinateur)
        current_hw_id = get_hardware_id()
        if lic_data["hardware_id"] != current_hw_id:
            return False, f"ÉCHEC : Cette licence appartient à un autre ordinateur.\nMachine autorisée: {lic_data['hardware_id']}\nMachine actuelle: {current_hw_id}"
            
        # 4. Vérification de l'Expiration temporelle
        expiry_date = datetime.strptime(lic_data["expiry_date"], "%Y-%m-%d")
        if datetime.now() > expiry_date:
            return False, f"ÉCHEC : La licence a expiré le {lic_data['expiry_date']}."
            
        return True, "Licence valide. Accès autorisé."
        
    except json.JSONDecodeError:
        return False, "Le fichier de licence n'est pas un JSON valide."
    except Exception as e:
        return False, f"Erreur système imprévue : {str(e)}"


# =============================================================================
# INTERFACE GRAPHIQUE (Tkinter) - ÉCRAN DE VERROUILLAGE
# =============================================================================

def auto_login() -> tuple[bool, str, str]:
    """Tente de lire la licence sauvegardée localement, retourne (is_valide, nom, prenom)"""
    if os.path.exists(LICENSE_SAVE_PATH):
        is_valid, _ = verify_license(LICENSE_SAVE_PATH)
        if is_valid:
            try:
                with open(LICENSE_SAVE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return True, data.get("first_name", ""), data.get("last_name", "")
            except:
                return True, "", ""
    return False, "", ""

class NuruLicenseApp(tk.Tk):
    """
    Fenêtre autonome de vérification de licence Desktop.
    Bloque l'accès à l'application principale tant qu'une licence valide
    n'est pas trouvée localement, ou n'a pas été fournie par l'utilisateur.
    """
    def __init__(self):
        super().__init__()
        self.title("Nuru Analytics - Sécurité & Activation")
        self.geometry("550x450")
        self.resizable(False, False)
        # Style minimaliste
        self.configure(bg="#f8fafc")
        self.attributes('-topmost', True) # Garder au premier plan
        
        # ID de l'ordinateur de l'étudiant
        self.computer_code = get_hardware_id()
        
        # Vérifier silencieusement si la licence est déjà activée
        is_ok, firstname, lastname = auto_login()
        if is_ok:
            self.access_granted = True
            self.destroy()
            return
            
        self.access_granted = False
        self.setup_ui()
        
        
    def setup_ui(self):
        """Construit l'interface graphique du portail"""
        
        # En-tête
        header = tk.Label(self, text="Activation Nuru Analytics", font=("Helvetica", 18, "bold"), bg="#f8fafc", fg="#0f172a")
        header.pack(pady=(20, 5))
        
        sub = tk.Label(self, text="Veuillez importer votre licence universitaire ou professionnelle.", font=("Helvetica", 10), bg="#f8fafc", fg="#64748b")
        sub.pack(pady=(0, 20))
        
        # Section : Code Machine 
        hw_frame = tk.Frame(self, bg="#ffffff", bd=1, relief="solid")
        hw_frame.pack(padx=30, pady=10, fill="x")
        
        lbl_hw = tk.Label(hw_frame, text="CODE MACHINE UNIQUE (À envoyer à l'équipe Nuru) :", font=("Helvetica", 9, "bold"), bg="#ffffff", fg="#3b82f6")
        lbl_hw.pack(pady=(10, 5))
        
        self.txt_hw = tk.Entry(hw_frame, font=("Courier", 14, "bold"), justify="center", fg="#1e293b", bd=0, bg="#f1f5f9")
        self.txt_hw.insert(0, self.computer_code)
        self.txt_hw.config(state="readonly") # Lecture seule mais copiable
        self.txt_hw.pack(pady=(0, 10), padx=20, fill="x")
        
        # Section : Formulaire Identité (Optionnel si lu dans la licence, mais demandé)
        form_frame = tk.Frame(self, bg="#f8fafc")
        form_frame.pack(padx=30, pady=10, fill="x")
        
        tk.Label(form_frame, text="Prénom :", bg="#f8fafc", font=("Helvetica", 9)).grid(row=0, column=0, sticky="w", pady=5)
        self.entry_prenom = tk.Entry(form_frame, width=20, font=("Helvetica", 11))
        self.entry_prenom.grid(row=0, column=1, padx=10, pady=5)
        
        tk.Label(form_frame, text="Nom :", bg="#f8fafc", font=("Helvetica", 9)).grid(row=0, column=2, sticky="w", pady=5)
        self.entry_nom = tk.Entry(form_frame, width=20, font=("Helvetica", 11))
        self.entry_nom.grid(row=0, column=3, padx=10, pady=5)

        # Actions
        btn_import = tk.Button(self, text="📁 Importer mon Fichier (.lic)", bg="#4f46e5", fg="white", font=("Helvetica", 11, "bold"), relief="flat", cursor="hand2", command=self.import_license)
        btn_import.pack(pady=(20, 10), ipadx=10, ipady=5)
        
        btn_exit = tk.Button(self, text="Quitter l'application", bg="#e2e8f0", fg="#475569", font=("Helvetica", 10), relief="flat", cursor="hand2", command=self.quit)
        btn_exit.pack(pady=5)
        
        # Message d'erreur
        self.lbl_status = tk.Label(self, text="", font=("Helvetica", 9, "bold"), bg="#f8fafc")
        self.lbl_status.pack(pady=10)

    def import_license(self):
        """Action du bouton d'importation"""
        if not self.entry_prenom.get() or not self.entry_nom.get():
            self.lbl_status.config(text="Veuillez d'abord saisir votre Nom et Prénom.", fg="#ef4444")
            return
            
        file_path = filedialog.askopenfilename(
            title="Sélectionnez votre fichier de licence Nuru",
            filetypes=(("Fichiers de Licence", "*.lic *.json"), ("Tous les fichiers", "*.*"))
        )
        
        if not file_path:
            return
            
        # Lancement de la vérification cryptographique
        is_valid, message = verify_license(file_path)
        
        if is_valid:
            # Succès ! On sauvegarde la licence localement pour les prochaines sessions
            try:
                import shutil
                shutil.copy(file_path, LICENSE_SAVE_PATH)
            except Exception:
                pass
            
            messagebox.showinfo("Activation Réussie", f"Bienvenue {self.entry_prenom.get()} {self.entry_nom.get()} !\n{message}")
            self.access_granted = True
            self.destroy() # Ferme le verrou et libère l'accès au Main
        else:
            # Échec
            self.lbl_status.config(text=message, fg="#dc2626")
            messagebox.showerror("Erreur de Licence", message)


# =============================================================================
# EXEMPLE D'UTILISATION (POINT D'ENTRÉE)
# =============================================================================

def run_license_check():
    """
    Fonction à appeler AVANT de lancer votre serveur Flask ou votre fenêtre PyWebView.
    Retourne True si l'étudiant est vérifié, False s'il a quitté sans activer.
    """
    app = NuruLicenseApp()
    app.mainloop()
    return getattr(app, 'access_granted', False)


if __name__ == "__main__":
    # Test autonome du sous-système de licence.
    print("Démarrage du système de vérification des licences...")
    has_access = run_license_check()
    
    if has_access:
        print("MOTEUR DÉVERROUILLÉ. Lancement de Nuru Analytics...")
        # Lancer la suite de l'app ici...
    else:
        print("Accès refusé ou fenêtre fermée. Fermeture du processus.")
