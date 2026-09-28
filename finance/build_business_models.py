"""Smart Tontine — comparaison et validation de 6 modèles économiques (Burkina Faso puis UEMOA).

Génère finance/SmartTontine_modeles_economiques.xlsx. Tout est en formules : les hypothèses
(onglet « Hypothèses ») pilotent le déploiement pays par pays, puis le compte de résultat
de chaque modèle et le tableau de validation (onglet « Comparatif »).
"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

OUT = Path(__file__).with_name("SmartTontine_modeles_economiques.xlsx")
YEARS = ["2027", "2028", "2029", "2030", "2031"]
YC = ["C", "D", "E", "F", "G"]  # colonnes des années
H = "'Hypothèses'"
D = "'Déploiement'"
M = "'Modèles'"

FONT = "Arial"
BLUE, BLACK, GREEN = Font(name=FONT, color="0000FF"), Font(name=FONT), Font(name=FONT, color="008000")
BOLD = Font(name=FONT, bold=True)
NOTE = Font(name=FONT, size=9, color="555555")
HEAD_FILL = PatternFill("solid", fgColor="1F6F43")      # vert Burkina / Smart Tontine
SECTION_FILL = PatternFill("solid", fgColor="E8F3EC")
KEY_FILL = PatternFill("solid", fgColor="FFFF00")
TOP = Border(top=Side(style="thin", color="000000"))

MF = '#,##0.0,," M";(#,##0.0,," M");"-"'
F = '#,##0;(#,##0);"-"'
PCT = '0.0%;(0.0%);"-"'
PCT2 = '0.00%;(0.00%);"-"'
X = '0.0"x";(0.0"x");"-"'
YEAR = '0'

wb = Workbook()


def header(ws, row, labels, widths):
    for i, label in enumerate(labels, start=1):
        c = ws.cell(row=row, column=i, value=label)
        c.font = Font(name=FONT, bold=True, color="FFFFFF")
        c.fill = HEAD_FILL
        c.alignment = Alignment(horizontal="left" if i <= 2 else "center", vertical="center", wrap_text=True)
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def title(ws, text, sub, span=9):
    ws["A1"] = text
    ws["A1"].font = Font(name=FONT, bold=True, size=14, color="FFFFFF")
    for col in range(1, span + 1):
        ws.cell(row=1, column=col).fill = HEAD_FILL
    ws["A2"] = sub
    ws["A2"].font = Font(name=FONT, italic=True, color="555555")


def section(ws, row, label, span=9):
    ws.cell(row=row, column=1, value=label).font = Font(name=FONT, bold=True, color="1F6F43")
    for col in range(1, span + 1):
        ws.cell(row=row, column=col).fill = SECTION_FILL


# ═════════════════════════════ HYPOTHÈSES ═════════════════════════════
h = wb.active
h.title = "Hypothèses"
title(h, "Smart Tontine — Hypothèses", "Cellules bleues = saisies · fond jaune = hypothèses clés à valider sur le terrain · montants en FCFA")
h["A3"] = "Toutes les valeurs sont des hypothèses de travail (ordres de grandeur) à confirmer : sources et statut dans la colonne commentaire."
h["A3"].font = NOTE
ref = {}

# 1) Pays
section(h, 5, "1. Pays et calendrier de déploiement")
for i, label in enumerate(["Pays", "Année de lancement", "Adultes 15+ (millions)", "Coefficient de marché",
                           "Cotisation mensuelle moyenne (F)", "Commentaire"], start=1):
    c = h.cell(row=6, column=i, value=label)
    c.font = BOLD
    c.alignment = Alignment(wrap_text=True)
COUNTRIES = [
    ("Burkina Faso", 2027, 12.9, 1.0, 12_500, "Pays de lancement. ≈ 23-24 M d'habitants (projections INSD, à confirmer) ; Orange Money, Moov Money, Wave, Sank Money."),
    ("Côte d'Ivoire", 2029, 18.0, 0.7, 20_000, "Forte communauté burkinabè (tontines et transferts transfrontaliers) ; concurrence plus forte."),
    ("Mali", 2030, 12.0, 0.7, 12_500, "Proche du Burkina (AES, UEMOA) ; risque sécuritaire."),
    ("Niger", 2031, 12.5, 0.6, 10_000, "Idem ; marché Mobile Money moins mûr."),
    ("Sénégal", 2031, 10.5, 0.5, 20_000, "Concurrents installés (Maman Tontine, MaTontine) : coefficient réduit."),
    ("Bénin / Togo", 2032, 13.0, 0.7, 15_000, "Deux marchés regroupés."),
]
C_ROW0 = 7
for i, (name, year, adults, coef, contrib, note) in enumerate(COUNTRIES):
    r = C_ROW0 + i
    h.cell(row=r, column=1, value=name).font = BLACK
    for col, v, fmt in [(2, year, YEAR), (3, adults, '0.0'), (4, coef, '0.00'), (5, contrib, F)]:
        c = h.cell(row=r, column=col, value=v)
        c.font = BLUE
        c.number_format = fmt
    h.cell(row=r, column=5).fill = KEY_FILL
    h.cell(row=r, column=6, value=note).font = NOTE
N_C = len(COUNTRIES)

r = C_ROW0 + N_C + 1
section(h, r, "2. Hypothèses par année (colonnes = années ; pour la courbe d'adoption, colonnes = années depuis le lancement)")
r += 1
for i, label in enumerate(["Hypothèse", "Unité", *YEARS, "Commentaire"], start=1):
    h.cell(row=r, column=i, value=label).font = BOLD
r += 1
SERIES = [
    ("adoption", "Membres actifs / adultes, par année depuis le lancement (1 à 5)", "%", [0.0006, 0.0023, 0.0055, 0.009, 0.013],
     "Burkina A5 ≈ 168 000 membres actifs (1,3 % des adultes). Référence : Maman Tontine revendique 30 000+ utilisateurs au Sénégal.", True, PCT2),
    ("recirc", "Part des cotisations payées depuis le solde Smart Tontine", "%", [0.15, 0.25, 0.30, 0.35, 0.40],
     "Argent qui ne ressort pas : pot gardé pour le tour suivant, avance, épargne. Évite les frais opérateurs d'entrée et de sortie.", True, PCT),
    ("credit_uptake", "Membres empruntant dans l'année (avance ou microcrédit)", "%", [0.03, 0.06, 0.10, 0.12, 0.14], "", True, PCT),
    ("b2b_members", "Membres de SFD partenaires gérés sur la plateforme (canal B2B)", "membres", [5_000, 30_000, 80_000, 150_000, 250_000],
     "Tontines et groupes d'épargne des SFD partenaires numérisés en marque blanche (≈ 1,47 M de comptes SFD au Burkina en 2024).", True, F),
    ("headcount", "Effectif siège (ETP)", "ETP", [8, 12, 16, 20, 24], "Hors équipes pays (comptées dans le coût fixe par pays).", False, F),
    ("credit_ramp", "Montée en charge de l'équipe crédit", "%", [0, 0.5, 1, 1, 1], "Le crédit démarre en 2028 (pilote) : pas d'équipe crédit complète avant.", False, PCT),
]
for key, label, unit, vals, note, key_flag, fmt in SERIES:
    h.cell(row=r, column=1, value=label).font = BLACK
    h.cell(row=r, column=2, value=unit).font = BLACK
    for j, v in enumerate(vals):
        c = h.cell(row=r, column=3 + j, value=v)
        c.font = BLUE
        c.number_format = fmt
        if key_flag:
            c.fill = KEY_FILL
    h.cell(row=r, column=8, value=note).font = NOTE
    ref[key] = r
    r += 1

r += 1
section(h, r, "3. Hypothèses constantes")
r += 1
CONSTS = [
    ("k_col", "Coût d'encaissement Mobile Money (payé par la plateforme)", "%", 0.010, PCT, "À négocier avec Orange Money, Moov, Wave ; agrégateurs locaux (ex. Senfenico) 1-2 %. HYPOTHÈSE CRITIQUE.", True),
    ("k_pay", "Coût de décaissement vers Mobile Money", "%", 0.005, PCT, "", True),
    ("sms", "SMS et notifications par membre et par an", "F", 150, F, "Push et WhatsApp en priorité ; SMS seulement pour l'OTP et les membres sans smartphone.", False),
    ("cloud", "Hébergement et services par membre et par an", "F", 120, F, "", False),
    ("kyc", "Coût KYC par nouveau membre vérifié", "F", 250, F, "50 % des nouveaux membres vérifiés.", False),
    ("kyc_share", "Part des nouveaux membres vérifiés", "%", 0.5, PCT, "", False),
    ("group", "Taille moyenne d'une tontine / d'un groupe", "membres", 12, F, "", False),
    ("pro_price", "Abonnement « Organisateur Pro » (par mois)", "F", 2_000, F, "Pour trésoriers de tontines, associations, GIE : tableau de bord, relances, exports, plusieurs groupes.", False),
    ("plus_price", "Abonnement membre « Smart Tontine+ » (par mois)", "F", 500, F, "Retrait du pot offert, avance à taux réduit, support prioritaire.", False),
    ("balance", "Solde moyen conservé par membre actif", "F", 8_000, F, "Base du float.", False),
    ("float_yield", "Rendement du float (compte de cantonnement / dépôt à terme)", "%", 0.03, PCT, "À négocier avec la banque ou le SFD partenaire.", False),
    ("loan", "Crédit moyen (avance ou microcrédit)", "F", 50_000, F, "", False),
    ("loan_margin", "Intérêts perçus sur la durée du crédit (% du montant)", "%", 0.045, PCT, "1,5 % par mois × 3 mois en moyenne, sous le taux d'usure.", False),
    ("share", "Part des intérêts revenant à Smart Tontine", "%", 0.40, PCT, "Le SFD partenaire finance et porte le crédit.", True),
    ("loss", "Pertes sur crédits (% des montants versés)", "%", 0.03, PCT,
     "Prudence : le secteur SFD burkinabè a vu son résultat baisser de 34,8 % en 2024 (BCEAO) ; avances adossées au pot moins risquées.", True),
    ("first_loss", "Part des pertes garantie par Smart Tontine", "%", 0.50, PCT, "", False),
    ("orig_fee", "Frais d'apport sur crédit accordé via le canal SFD (payés par le SFD)", "%", 0.01, PCT, "", False),
    ("ins_uptake", "Membres souscrivant une micro-assurance", "%", 0.10, PCT, "Assurance décès / santé des membres de tontine (partenaire assureur).", False),
    ("ins_premium", "Prime annuelle moyenne", "F", 3_000, F, "", False),
    ("ins_comm", "Commission de distribution d'assurance", "%", 0.20, PCT, "", False),
    ("saas", "Licence SFD : prix par membre géré et par mois", "F", 75, F, "Payé par le SFD. Plafonné par sa rentabilité : ≈ 3 Mds F de résultat pour 1,47 M de comptes en 2024 (BCEAO), soit ≈ 2 000 F/compte/an.", True),
    ("b2b_contrib", "Cotisation mensuelle moyenne d'un membre SFD", "F", 10_000, F, "", False),
    ("salary", "Coût annuel chargé moyen d'un ETP siège", "F", 6_000_000, F, "≈ 500 000 F/mois chargés (Ouagadougou).", False),
    ("country_fixed", "Coût fixe annuel par pays ouvert", "F", 45_000_000, F, "Responsable pays, 2-3 animateurs, bureau, juridique, frais partenaires.", False),
    ("country_mkt", "Marketing de marque par pays ouvert et par an", "F", 12_000_000, F, "", False),
    ("tech_fixed", "Charges fixes siège (tech, audit, sécurité, loyer)", "F", 40_000_000, F, "", False),
    ("credit_team", "Équipe crédit et risques (si crédit)", "F", 30_000_000, F, "", False),
    ("b2b_team", "Équipe ventes et intégration SFD (si B2B)", "F", 25_000_000, F, "", False),
    ("capex", "Investissement de lancement", "F", 45_000_000, F, "Plateforme déjà développée (ce dépôt) : durcissement, audit de sécurité, intégrations opérateurs.", False),
    ("tax", "Impôt sur les sociétés", "%", 0.275, PCT, "Taux IS Burkina Faso 27,5 % (à confirmer).", False),
    ("discount", "Taux d'actualisation (VAN)", "%", 0.20, PCT, "Exigence d'un investisseur early-stage en Afrique de l'Ouest.", False),
]
for key, label, unit, v, fmt, note, key_flag in CONSTS:
    h.cell(row=r, column=1, value=label).font = BLACK
    h.cell(row=r, column=2, value=unit).font = BLACK
    c = h.cell(row=r, column=3, value=v)
    c.font = BLUE
    c.number_format = fmt
    if key_flag:
        c.fill = KEY_FILL
    h.cell(row=r, column=8, value=note).font = NOTE
    ref[key] = r
    r += 1

# 4) Matrice des modèles
r += 1
section(h, r, "4. Les 6 modèles économiques testés (une colonne par modèle)")
r += 1
MODELS = [
    ("A", "Commission seule", "Clone de Maman Tontine : 1 % sur chaque pot, retrait gratuit, frais opérateurs à la charge de la plateforme."),
    ("B", "Transactionnel", "1 % sur les pots + 1 % sur les retraits vers Mobile Money + float."),
    ("C", "Freemium abonnements", "Gratuit pour les membres (frais opérateurs refacturés au coût), revenus = abonnements Organisateur Pro et Smart Tontine+."),
    ("D", "Tontine + microfinance", "B + part des intérêts de crédit (SFD partenaire) + micro-assurance."),
    ("E", "B2B pour les SFD", "Plateforme en marque blanche vendue aux SFD : licence par membre + frais d'apport de crédit. Pas de B2C."),
    ("F", "Hybride Smart Tontine", "D + abonnements Organisateur Pro / Smart Tontine+ + canal B2B SFD (à moitié de E)."),
    ("G", "Hybride optimisé (recommandé)", "F + trois leviers structurels : cotisations prélevées sur le compte SFD et tarifs opérateurs négociés (−40 % de frais Mobile Money), "
     "siège resserré à Ouagadougou (−20 % de coûts siège), canal SFD exploité à 100 %."),
]
MCOL = {code: get_column_letter(3 + i) for i, (code, _, _) in enumerate(MODELS)}  # C..I
h.cell(row=r, column=1, value="Paramètre").font = BOLD
for i, (code, name, _) in enumerate(MODELS):
    c = h.cell(row=r, column=3 + i, value=f"{code} — {name}")
    c.font = BOLD
    c.alignment = Alignment(wrap_text=True)
h.row_dimensions[r].height = 30
r += 1
MATRIX = [
    ("b2c", "Canal B2C (application grand public) actif", [1, 1, 1, 1, 0, 1, 1], '0'),
    ("comm", "Commission sur chaque pot versé", [0.01, 0.01, 0, 0.01, 0, 0.01, 0.01], PCT),
    ("wd_fee", "Frais sur les retraits vers Mobile Money", [0, 0.01, 0, 0.01, 0, 0.01, 0.01], PCT),
    ("passthrough", "Frais opérateurs refacturés au membre (1 = oui)", [0, 0, 1, 0, 1, 0, 0], '0'),
    ("pro_conv", "Groupes abonnés Organisateur Pro", [0, 0, 0.25, 0, 0, 0.15, 0.15], PCT),
    ("plus_conv", "Membres abonnés Smart Tontine+", [0, 0, 0.05, 0, 0, 0.03, 0.03], PCT),
    ("float_on", "Revenus du float (1 = oui)", [1, 1, 1, 1, 0, 1, 1], '0'),
    ("credit_on", "Crédit via SFD partenaire (1 = oui)", [0, 0, 0, 1, 0, 1, 1], '0'),
    ("ins_on", "Micro-assurance (1 = oui)", [0, 0, 0, 1, 0, 1, 1], '0'),
    ("b2b_share", "Part du potentiel B2B SFD captée", [0, 0, 0, 0, 1, 0.5, 1], PCT),
    ("cac", "Coût d'acquisition par nouveau membre B2C (F)", [1_200, 1_200, 1_400, 1_200, 0, 1_000, 1_000], F),
    ("cac_b2b", "Coût d'acquisition par membre B2B (formation, lancement chez le SFD)", [0, 0, 0, 0, 300, 300, 300], F),
    ("mm_saving", "Levier : réduction des frais Mobile Money", [0, 0, 0, 0, 0, 0, 0.40], PCT),
    ("recirc_add", "Levier : points de recirculation en plus", [0, 0, 0, 0, 0, 0, 0], PCT),
    ("hq_saving", "Levier : réduction des coûts siège", [0, 0, 0, 0, 0, 0, 0.20], PCT),
]
MATRIX_NOTES = {
    "cac": "F : moins cher grâce aux organisateurs Pro qui recrutent leur groupe (commission parrainage incluse).",
    "passthrough": "C et E : le membre (ou le SFD) paie les frais Mobile Money au coût réel.",
    "mm_saving": "G : cotisations prélevées sur le compte d'épargne SFD (pas de frais opérateur) + tarifs négociés (objectif ≤ 0,7 % / 0,3 %).",
    "recirc_add": "Testé : neutre sur la rentabilité (les frais de retrait compensent les frais opérateurs évités) ; utile pour la fidélisation, pas pour la marge.",
    "hq_saving": "G : équipe siège resserrée (Ouagadougou), tech mutualisée, fonctions support partagées avec le SFD.",
}
for key, label, vals, fmt in MATRIX:
    h.cell(row=r, column=1, value=label).font = BLACK
    for i, v in enumerate(vals):
        c = h.cell(row=r, column=3 + i, value=v)
        c.font = BLUE
        c.number_format = fmt
    if key in MATRIX_NOTES:
        h.cell(row=r, column=10, value=MATRIX_NOTES[key]).font = NOTE
    ref[key] = r
    r += 1
for i, (code, name, desc) in enumerate(MODELS):
    h.cell(row=r + i + 1, column=1, value=f"{code} — {name}").font = BOLD
    h.cell(row=r + i + 1, column=3, value=desc).font = NOTE
h.column_dimensions["A"].width = 58
h.column_dimensions["B"].width = 12
for col in "CDEFGHI":
    h.column_dimensions[col].width = 15
h.column_dimensions["J"].width = 60
h.freeze_panes = "C5"


def hc(key):
    """Constante."""
    return f"{H}!$C${ref[key]}"


def hy(key, col):
    """Série annuelle."""
    return f"{H}!{col}${ref[key]}"


def hm(key, code):
    """Paramètre du modèle."""
    return f"{H}!${MCOL[code]}${ref[key]}"


# ═════════════════════════════ DÉPLOIEMENT ═════════════════════════════
d = wb.create_sheet("Déploiement")
title(d, "Smart Tontine — Déploiement pays par pays (canal B2C)", "Membres actifs = adultes × courbe d'adoption (selon l'ancienneté du pays) × coefficient de marché")
header(d, 4, ["Pays / indicateur", "Unité", *YEARS], [40, 12, 14, 14, 14, 14, 14])
dr = {}
row = 5
ADOPT = f"{H}!$C${ref['adoption']}:$G${ref['adoption']}"
for i, (name, *_rest) in enumerate(COUNTRIES):
    hr = C_ROW0 + i
    section(d, row, name, 7)
    row += 1
    d.cell(row=row, column=1, value="Ancienneté (années)").font = BLACK
    for j, col in enumerate(YC):
        c = d[f"{col}{row}"]
        c.value = f"=MAX(0,{YEARS[j]}-{H}!$B${hr}+1)"
        c.number_format = '0'
    age = row
    row += 1
    d.cell(row=row, column=1, value="Membres actifs").font = BLACK
    d.cell(row=row, column=2, value="membres").font = BLACK
    for col in YC:
        c = d[f"{col}{row}"]
        c.value = f"=IF({col}{age}=0,0,{H}!$C${hr}*1000000*INDEX({ADOPT},1,MIN(5,{col}{age}))*{H}!$D${hr})"
        c.number_format = F
    dr[f"act{i}"] = row
    row += 1
    d.cell(row=row, column=1, value="Cotisations annuelles (= pots versés)").font = BLACK
    d.cell(row=row, column=2, value="M F").font = BLACK
    for col in YC:
        c = d[f"{col}{row}"]
        c.value = f"={col}{dr[f'act{i}']}*{H}!$E${hr}*12"
        c.number_format = MF
    dr[f"vol{i}"] = row
    row += 1
    d.cell(row=row, column=1, value="Pays ouvert (1/0)").font = BLACK
    for col in YC:
        d[f"{col}{row}"].value = f"=IF({col}{age}>0,1,0)"
    dr[f"open{i}"] = row
    row += 1

section(d, row, "Total", 7)
row += 1
TOT = [
    ("members", "Membres actifs B2C", "membres", lambda col, pc: "=" + "+".join(f"{col}{dr[f'act{i}']}" for i in range(N_C)), F),
    ("new", "Nouveaux membres B2C", "membres", lambda col, pc: f"=MAX(0,{col}{{members}}-{pc}{{members}})" if pc else f"={col}{{members}}", F),
    ("volume", "Cotisations B2C (= pots versés)", "M F", lambda col, pc: "=" + "+".join(f"{col}{dr[f'vol{i}']}" for i in range(N_C)), MF),
    ("countries", "Pays ouverts", "pays", lambda col, pc: "=" + "+".join(f"{col}{dr[f'open{i}']}" for i in range(N_C)), '0'),
    ("b2b", "Membres SFD (potentiel B2B)", "membres", lambda col, pc: f"={hy('b2b_members', col)}", F),
    ("b2b_new", "Nouveaux membres SFD", "membres", lambda col, pc: f"=MAX(0,{col}{{b2b}}-{pc}{{b2b}})" if pc else f"={col}{{b2b}}", F),
]
for key, label, unit, fn, fmt in TOT:
    dr[key] = row
    d.cell(row=row, column=1, value=label).font = BOLD
    d.cell(row=row, column=2, value=unit).font = BLACK
    for j, col in enumerate(YC):
        formula = fn(col, YC[j - 1] if j else None).replace("{members}", str(dr.get("members", 0))).replace("{b2b}", str(dr.get("b2b", 0)))
        c = d[f"{col}{row}"]
        c.value = formula
        c.number_format = fmt
        c.font = BOLD
    row += 1
d.freeze_panes = "C5"


def dv(key, col):
    return f"{D}!{col}${dr[key]}"


# ═════════════════════════════ MODÈLES ═════════════════════════════
m = wb.create_sheet("Modèles")
title(m, "Smart Tontine — Compte de résultat de chaque modèle", "Montants en millions de FCFA · mêmes marchés, mêmes coûts : seuls les paramètres de la matrice (Hypothèses §4) changent")
header(m, 4, ["Indicateur", "Unité", *YEARS, "Méthode"], [48, 10, 13, 13, 13, 13, 13, 70])
m.freeze_panes = "C5"
mr = {}  # (code, key) -> row
row = 5

LINES = [
    # key, label, unit, formula(code, col, pc, R), fmt, bold, note
    ("members", "Membres actifs B2C", "membres", lambda c, col, pc, R: f"={dv('members', col)}*{hm('b2c', c)}", F, False, ""),
    ("b2b", "Membres SFD gérés (B2B)", "membres", lambda c, col, pc, R: f"={dv('b2b', col)}*{hm('b2b_share', c)}", F, False, ""),
    ("volume", "Cotisations B2C (= pots versés)", "M F", lambda c, col, pc, R: f"={dv('volume', col)}*{hm('b2c', c)}", MF, False, ""),
    ("outflow", "Pots retirés vers Mobile Money", "M F", lambda c, col, pc, R: f"={R('volume')}*(1-MIN(0.9,{hy('recirc', col)}+{hm('recirc_add', c)}))", MF, False,
     "cotisations × (1 − recirculation) : ce qui entre par Mobile Money finit par ressortir"),
    ("credit", "Crédits versés (via SFD)", "M F", lambda c, col, pc, R: f"={R('members')}*{hy('credit_uptake', col)}*{hc('loan')}*{hm('credit_on', c)}", MF, False, ""),
    ("§", "Revenus"),
    ("r_comm", "Commission sur les pots", "M F", lambda c, col, pc, R: f"={R('volume')}*{hm('comm', c)}", MF, False, ""),
    ("r_wd", "Frais de retrait", "M F", lambda c, col, pc, R: f"={R('outflow')}*{hm('wd_fee', c)}", MF, False, ""),
    ("r_pro", "Abonnements Organisateur Pro", "M F", lambda c, col, pc, R: f"={R('members')}/{hc('group')}*{hm('pro_conv', c)}*{hc('pro_price')}*12", MF, False, "groupes × conversion × prix × 12"),
    ("r_plus", "Abonnements Smart Tontine+", "M F", lambda c, col, pc, R: f"={R('members')}*{hm('plus_conv', c)}*{hc('plus_price')}*12", MF, False, ""),
    ("r_float", "Revenus du float", "M F", lambda c, col, pc, R: f"={R('members')}*{hc('balance')}*{hc('float_yield')}*{hm('float_on', c)}", MF, False, ""),
    ("r_credit", "Part des intérêts de crédit", "M F", lambda c, col, pc, R: f"={R('credit')}*{hc('loan_margin')}*{hc('share')}", MF, False, ""),
    ("r_ins", "Commissions d'assurance", "M F", lambda c, col, pc, R: f"={R('members')}*{hc('ins_uptake')}*{hc('ins_premium')}*{hc('ins_comm')}*{hm('ins_on', c)}", MF, False, ""),
    ("r_saas", "Licences SFD", "M F", lambda c, col, pc, R: f"={R('b2b')}*{hc('saas')}*12", MF, False, ""),
    ("r_orig", "Frais d'apport de crédit (SFD)", "M F", lambda c, col, pc, R: f"={R('b2b')}*{hy('credit_uptake', col)}*{hc('loan')}*{hc('orig_fee')}", MF, False, ""),
    ("revenue", "Chiffre d'affaires", "M F", lambda c, col, pc, R: f"=SUM({col}{R.row('r_comm')}:{col}{R.row('r_orig')})", MF, True, ""),
    ("§", "Coûts variables"),
    ("c_mm", "Frais Mobile Money (entrée + sortie)", "M F", lambda c, col, pc, R: f"={R('outflow')}*({hc('k_col')}+{hc('k_pay')})*(1-{hm('passthrough', c)})*(1-{hm('mm_saving', c)})", MF, False,
     "seul l'argent qui entre et ressort par Mobile Money coûte des frais"),
    ("c_ops", "SMS, hébergement", "M F", lambda c, col, pc, R: f"=({R('members')}+0.5*{R('b2b')})*({hc('sms')}+{hc('cloud')})", MF, False, "membres SFD comptés à 50 %"),
    ("c_kyc", "KYC", "M F", lambda c, col, pc, R: (f"=MAX(0,{R('members')}-{pc}{R.row('members')})*{hc('kyc_share')}*{hc('kyc')}" if pc else f"={R('members')}*{hc('kyc_share')}*{hc('kyc')}"), MF, False, ""),
    ("c_risk", "Garantie de première perte (crédit)", "M F", lambda c, col, pc, R: f"={R('credit')}*{hc('loss')}*{hc('first_loss')}", MF, False, ""),
    ("c_acq", "Acquisition", "M F", lambda c, col, pc, R: (
        f"=MAX(0,{R('members')}-{pc}{R.row('members')})*{hm('cac', c)}+MAX(0,{R('b2b')}-{pc}{R.row('b2b')})*{hm('cac_b2b', c)}" if pc
        else f"={R('members')}*{hm('cac', c)}+{R('b2b')}*{hm('cac_b2b', c)}"), MF, False, "nouveaux membres × CAC"),
    ("var", "Total coûts variables", "M F", lambda c, col, pc, R: f"=SUM({col}{R.row('c_mm')}:{col}{R.row('c_acq')})", MF, True, ""),
    ("contrib", "Marge sur coûts variables", "M F", lambda c, col, pc, R: f"={R('revenue')}-{R('var')}", MF, True, ""),
    ("§", "Coûts fixes"),
    ("f_hq", "Siège (équipe + charges fixes)", "M F", lambda c, col, pc, R: f"=({hy('headcount', col)}*{hc('salary')}+{hc('tech_fixed')})*(1-{hm('hq_saving', c)})", MF, False, ""),
    ("f_country", "Pays ouverts (équipes + marque)", "M F", lambda c, col, pc, R: f"={dv('countries', col)}*({hc('country_fixed')}+{hc('country_mkt')})*{hm('b2c', c)}+{dv('countries', col)}*{hc('country_fixed')}*0.5*(1-{hm('b2c', c)})", MF, False,
     "B2C : coût pays complet ; modèle E (sans B2C) : demi-coût, pas de marque"),
    ("f_teams", "Équipes crédit / B2B", "M F", lambda c, col, pc, R: f"={hc('credit_team')}*{hy('credit_ramp', col)}*{hm('credit_on', c)}+{hc('b2b_team')}*IF({hm('b2b_share', c)}>0,1,0)", MF, False, ""),
    ("fixed", "Total coûts fixes", "M F", lambda c, col, pc, R: f"=SUM({col}{R.row('f_hq')}:{col}{R.row('f_teams')})", MF, True, ""),
    ("§", "Résultat et trésorerie"),
    ("ebitda", "EBITDA", "M F", lambda c, col, pc, R: f"={R('contrib')}-{R('fixed')}", MF, True, ""),
    ("tax", "Impôt (sur EBITDA − amortissement si positif)", "M F", lambda c, col, pc, R: f"=MAX(0,{R('ebitda')}-{hc('capex')}/3*IF({YC.index(col)}<3,1,0))*{hc('tax')}", MF, False, ""),
    ("cash", "Flux de trésorerie", "M F", lambda c, col, pc, R: f"={R('ebitda')}-{R('tax')}-IF({YC.index(col)}=0,{hc('capex')},0)", MF, False, ""),
    ("cum", "Trésorerie cumulée", "M F", lambda c, col, pc, R: f"={pc}{R.row('cum')}+{R('cash')}" if pc else f"={R('cash')}", MF, True, ""),
    ("pos", "EBITDA positif (1 = oui)", "indicateur", lambda c, col, pc, R: f"=IF({R('ebitda')}>0,1,0)", '0', False, ""),
    ("margin_member", "Marge sur coûts variables par membre (hors acquisition)", "F", lambda c, col, pc, R: (
        f"=IF(({R('members')}+{R('b2b')})=0,0,({R('contrib')}+{R('c_acq')})/({R('members')}+{R('b2b')}))"), F, False, "par membre (B2C + B2B) et par an"),
]


def block(code, name):
    global row
    section(m, row, f"Modèle {code} — {name}", 8)
    row += 1

    class Ref:
        def __call__(self, key):
            return f"{self.col}{mr[(code, key)]}"

        def row(self, key):
            return mr[(code, key)]

    R = Ref()
    for item in LINES:
        if item[0] == "§":
            m.cell(row=row, column=1, value=item[1]).font = Font(name=FONT, italic=True, bold=True, color="555555")
            row += 1
            continue
        key, label, unit, fn, fmt, bold, note = item
        mr[(code, key)] = row
        m.cell(row=row, column=1, value=label).font = BOLD if bold else BLACK
        m.cell(row=row, column=2, value=unit).font = BLACK
        for j, col in enumerate(YC):
            R.col = col
            c = m[f"{col}{row}"]
            c.value = fn(code, col, YC[j - 1] if j else None, R)
            c.number_format = fmt
            c.font = BOLD if bold else BLACK
            if bold:
                c.border = TOP
        if note:
            m.cell(row=row, column=8, value=note).font = NOTE
        row += 1
    row += 1


for code, name, _ in MODELS:
    block(code, name)

# ═════════════════════════════ COMPARATIF ═════════════════════════════
s = wb.create_sheet("Comparatif", 0)
title(s, "Smart Tontine — Quel modèle économique est rentable ?", "Validation sur 5 ans (2027-2031), Burkina Faso puis sous-région · M FCFA sauf mention contraire", 9)
header(s, 4, ["Critère", "Seuil de validation", *[f"{code} — {name}" for code, name, _ in MODELS]], [44, 18, 15, 15, 15, 15, 15, 15, 17])
s.row_dimensions[4].height = 42
MC = ["C", "D", "E", "F", "G", "H", "I"]  # colonnes des modèles dans le comparatif


def mrow(code, key):
    return mr[(code, key)]


CRIT = [
    ("rev31", "Chiffre d'affaires 2031", "—", lambda code: f"={M}!G{mrow(code, 'revenue')}", MF),
    ("ebitda31", "EBITDA 2031", "> 0", lambda code: f"={M}!G{mrow(code, 'ebitda')}", MF),
    ("ebitda_margin", "Marge d'EBITDA 2031", "≥ 15 %", lambda code: f"=IF({M}!G{mrow(code, 'revenue')}=0,0,{M}!G{mrow(code, 'ebitda')}/{M}!G{mrow(code, 'revenue')})", PCT),
    ("cum_ebitda", "EBITDA cumulé 2027-2031", "—", lambda code: f"=SUM({M}!C{mrow(code, 'ebitda')}:G{mrow(code, 'ebitda')})", MF),
    ("breakeven", "Première année d'EBITDA positif", "≤ 2029", lambda code: (
        f'=IFERROR(INDEX({M}!$C$4:$G$4,MATCH(1,{M}!C{mrow(code, "pos")}:G{mrow(code, "pos")},0)),"jamais")'), '@'),
    ("need", "Besoin de financement (creux de trésorerie)", "≤ 600 M F", lambda code: f"=-MIN(0,MIN({M}!C{mrow(code, 'cum')}:G{mrow(code, 'cum')}))", MF),
    ("margin_member", "Marge par membre et par an (2031, hors acquisition)", "> 0 F", lambda code: f"={M}!G{mrow(code, 'margin_member')}", F),
    ("npv", "VAN des flux 2027-2031 (20 %, sans valeur terminale)", "—", lambda code: f"=NPV({hc('discount')},{M}!C{mrow(code, 'cash')}:G{mrow(code, 'cash')})", MF),
]
cr = {}
for i, (key, label, threshold, fn, fmt) in enumerate(CRIT, start=5):
    cr[key] = i
    s.cell(row=i, column=1, value=label).font = BLACK
    s.cell(row=i, column=2, value=threshold).font = NOTE
    for j, (code, _, _) in enumerate(MODELS):
        c = s.cell(row=i, column=3 + j, value=fn(code))
        c.number_format = fmt
        c.font = GREEN
        c.alignment = Alignment(horizontal="right")
vr = 5 + len(CRIT)
VERDICTS = [
    ("VERDICT STRICT (EBITDA positif ≤ 2029 + tous les seuils)", 2029),
    ("VERDICT INVESTISSEUR (EBITDA positif ≤ 2030, autres seuils identiques)", 2030),
]
for k, (label, year_max) in enumerate(VERDICTS):
    rr = vr + k
    s.cell(row=rr, column=1, value=label).font = BOLD
    for j, col in enumerate(MC):
        be = f"{col}{cr['breakeven']}"
        c = s.cell(row=rr, column=3 + j, value=(
            f'=IF(AND({col}{cr["ebitda31"]}>0,{col}{cr["ebitda_margin"]}>=0.15,IFERROR(VALUE({be})<={year_max},FALSE),'
            f'{col}{cr["need"]}<=600000000,{col}{cr["margin_member"]}>0),"✔ RENTABLE","✘ NON VALIDÉ")'))
        c.font = BOLD
        c.alignment = Alignment(horizontal="center")
    s.row_dimensions[rr].height = 22
vr += 1
note_r = vr + 2
s.cell(row=note_r, column=1, value="Lecture").font = BOLD
notes = [
    "Les six modèles partagent le même déploiement (Burkina 2027 → Côte d'Ivoire → Mali → Niger/Sénégal → Bénin/Togo) et les mêmes coûts ; seuls les leviers de revenus diffèrent.",
    "Seuils fixés avant le calcul : EBITDA 2031 > 0 et marge ≥ 15 %, besoin de financement ≤ 600 M F (atteignable en pré-amorçage + amorçage), marge par membre positive, EBITDA positif en année 3 (strict) ou 4 (investisseur).",
    "Les hypothèses jaunes de l'onglet Hypothèses (coût Mobile Money, recirculation, adoption, pertes de crédit, prix des licences SFD) sont à valider par un pilote avant la levée.",
]
for k, t in enumerate(notes):
    c = s.cell(row=note_r + 1 + k, column=1, value=t)
    c.font = NOTE
    c.alignment = Alignment(wrap_text=True, vertical="top")
    s.merge_cells(start_row=note_r + 1 + k, start_column=1, end_row=note_r + 1 + k, end_column=9)
    s.row_dimensions[note_r + 1 + k].height = 30
s.freeze_panes = "C5"

# ═════════════════════════════ SENSIBILITÉ (modèle F) ═════════════════════════════
t = wb.create_sheet("Sensibilité G")
title(t, "Modèle G — Sensibilité de l'EBITDA 2031 (M FCFA)", "Adoption (lignes, en % de l'hypothèse) × coût Mobile Money entrée + sortie (colonnes) · approximation linéaire autour du scénario central", 8)
t.column_dimensions["A"].width = 34
for col in "BCDEF":
    t.column_dimensions[col].width = 14
t["A4"] = "Adoption ↓ / coût Mobile Money →"
t["A4"].font = BOLD
costs = [0.006, 0.009, 0.012, 0.015, 0.02]
adopts = [0.5, 0.75, 1.0, 1.25]
for j, cst in enumerate(costs):
    c = t.cell(row=4, column=2 + j, value=cst)
    c.font = Font(name=FONT, bold=True, color="0000FF")
    c.number_format = PCT
FR = lambda key: f"{M}!$G${mrow('G', key)}"  # noqa: E731
for i, a in enumerate(adopts):
    rr = 5 + i
    c = t.cell(row=rr, column=1, value=a)
    c.font = Font(name=FONT, bold=True, color="0000FF")
    c.number_format = '0%'
    for j in range(len(costs)):
        col = get_column_letter(2 + j)
        # Revenus et coûts variables B2C proportionnels à l'adoption ; frais Mobile Money recalculés au coût testé.
        cell = t[f"{col}{rr}"]
        cell.value = (f"=($A{rr})*({FR('contrib')}+{FR('c_mm')})-$A{rr}*{FR('outflow')}*{col}$4-{FR('fixed')}")
        # (colonnes = coût Mobile Money effectif entrée + sortie, après leviers)
        cell.number_format = MF
t["A10"] = "Le scénario central de G correspond à la ligne 100 % et à la colonne 0,9 % (1,5 % − 40 %). L'effet des membres B2B est lui aussi mis à l'échelle (approximation prudente)."
t["A10"].font = NOTE
t["D7"].fill = KEY_FILL

for ws in wb.worksheets:
    ws.sheet_view.showGridLines = False
h[f"C{ref['recirc']}"].comment = Comment("Levier clé : l'argent qui reste dans l'app n'engendre pas de frais opérateurs.", "Smart Tontine")
wb.save(OUT)
print(f"Modèle écrit : {OUT}")
