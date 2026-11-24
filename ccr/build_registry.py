"""
The CCR registry, rebuilt from the 9 Nov 2026 master register.
Run:  python3 build_registry.py
Writes registry.json (public and anonymised entries only; safe for the public repository).
Private entries go in private.json (not committed); with PRIVATE_OUT set, a full file for the server is written too.
"""
import json, os
E = []
def e(id, domain, title, date, status, visibility, summary="", aliases=(), signature=None, verdict=None, gate=None, kind="Case", note="", confirm=False):
    E.append(dict(id=id, aliases=list(aliases), domain=domain, title=title, date=date, status=status, visibility=visibility,
                  kind=kind, signature=signature, verdict=verdict, gate=gate, summary=summary, note=note, numberToConfirm=confirm))
U = lambda en, de=None, el=None: {"en": en, "de": de, "el": el}

e("CCR-URB-0001","URB","Rail edge, Athens","2026-06","Final","public","A rail edge in Athens where neighbourhood and infrastructure meet with no shared threshold.",note="Negative instance: a liminal trap.")
e("CCR-URB-0002","URB","Rural veranda","2026-06","Final","public","A rural veranda as a threshold between house, field and passers-by that works.",note="Positive instance: a threshold fulfilled.")
e("CCR-URB-0003","URB","The Two Stones, Agia, Larisa","","Final","public","A field plate on two stones at Agia, Larisa, read as a threshold between owners, use and landscape.")
e("CCR-URB-0004","URB","Skin Without Load","","Final","public","A building envelope that carries no load: facade logic separated from structural logic.")
e("CCR-URB-0005","URB","One Light, Two Breaths — Pandemic Architecture Competition brief","","Final","public","A competition brief for pandemic architecture: shared light and separate air between residents and care.")
e("CCR-URB-0006","URB","Casa Elettrica (Figini & Pollini, 1930)","2026-08","Provisional","public","A 1930 rationalist house where technology and dwelling are shown together but not mediated.",
  signature=U("The crossing shown, not made"),verdict={"class":"conditional","en":"Certified at the level of the manifesto; uncertified at the level of dwelling"},gate={"od":"3–4"})
e("CCR-URB-0007","URB","Kavala port — analysis of existing works","2026-08","Final","public","Meta-analysis of existing works at Kavala port: city, port authority, university and waterfront users.",aliases=["CCR-URB-KAV-0001"],kind="Analysis of others' work")
e("CCR-URB-0009","URB","Elaionas: Six Logics, One Threshold","2026-10-04","Provisional","public","An Athens industrial district under regeneration where six logics meet at one threshold.",aliases=["CCR-URB-ELA-0001"],kind="Analysis of a published brief")
e("CCR-MFG-0001","MFG","Steel fabrication line (client, anonymised)","2026-06","Final","anonymise","A steel fabrication value stream: sales, scheduling, workshop and site erection meet at hand-offs and stock.")
e("CCR-MFG-0002","MFG","Steel fabrication line, second entry (client, anonymised)","2026-06","Final","anonymise","Second reading of the steel fabrication value stream, after the first interventions.")
e("CCR-SEC-0001","SEC","Neither Open Nor Sealed — data security","2026-09","Final","public","Data security as five incompatible contextures (legal, engineering, business, data subject, adversary); zero trust as permanent threshold; privacy-enhancing technologies as transjunction.")
e("CCR-CCU-0001","CCU","Carbon capture — reading of an academic paper","","Final","public","A carbon-capture paper where chemistry, plant economics and climate accounting meet.")
e("CCR-SYS-0001","SYS","CCR libraries as gates above language models","","Final","public","Method note: a library of cases as a polycontextural gate above monocontextural language models.",kind="Method note")
e("CCR-SYS-0002","SYS","Prompt Injection as Contexture Collapse","2026-10-14","Provisional","public","Prompt injection read as the collapse of instruction and data contextures into one channel.")
e("CCR-SYS-0003","SYS","The Score That Closed Too Soon — Dutch childcare-benefits model","2026-11-09","Provisional","public","An algorithmic risk score that closed families' cases before law, care and evidence could meet.",
  signature=U("The score that closed too soon","Der Score, der zu früh schloss","Το σκορ που έκλεισε πρόωρα"),
  verdict={"class":"uncertified","en":"Uncertified on all three refusals"},gate={"od":5,"fit":8,"ret":2,"r":["Fail","Fail","Fail"]})
e("CCR-NRG-0001","NRG","Synchrony Refused, Connection Kept — SAFEr Grid","2026-11-07","Provisional","public","A grid that replaces synchronous frequency balance with store-and-forward balancing.",
  signature=U("Synchrony refused, connection kept","Synchronie verweigert, Verbindung bewahrt","Συγχρονία αρνημένη, σύνδεση διατηρημένη"),
  verdict={"class":"conditional","en":"Certified (technical) · uncertified (institutional)"},gate={"od":"~4","r":["Pass","Pass","Conditional"]})
e("CCR-NRG-0002","NRG","Where Compute Can Return — Kozani data centre","2026-11-08","Provisional","public","A data centre at a former lignite plant: grid, water, heat, jobs and land meet.",
  signature=U("The right ground, the wrong temperature","Der richtige Ort, die falsche Temperatur","Ο σωστός τόπος, η λάθος θερμοκρασία"),
  verdict={"class":"uncertified","en":"Uncertified as announced; conditional if reconfigured"},gate={"od":4,"fit":12,"ret":6,"r":["Conditional","Fail","Conditional"]})
e("CCR-NRG-0003","NRG","The Right Temperature, the Wrong Ground — Amsterdam-Zuidoost","2026-11-08","Provisional","public","A data centre in a dense urban district: heat reuse fits, but land and grid do not.",
  signature=U("The right temperature, the wrong ground","Die richtige Temperatur, der falsche Ort","Η σωστή θερμοκρασία, ο λάθος τόπος"),
  verdict={"class":"uncertified","en":"Uncertified"},gate={"od":5,"fit":6,"ret":8,"r":["Fail","Conditional","Fail"]})
# Entries from earlier chats whose numbers clash or were never added to the master register.
e("CCR-SYS-0004","SYS","Canvas als Prompt — the whole canvas as a prompt","2026-09","Provisional","public","A vendor claim that fuses team, tool and prompt logics into one surface: conjunction sold as synthesis.",
  aliases=["CCR-SYS-0002 (Sept 2026)"],confirm=True,note="Proposed number; was issued as SYS-0002 in September.")
e("CCR-SYS-0005","SYS","Swiss nuclear new-build referendum","2026-09","Provisional","public","A yes/no ballot that can register only political legitimacy while supply security, decarbonisation and capital stay blocked.",
  aliases=["CCR-SYS-0003 (Sept 2026)"],signature=U("Every outcome a Pyrrhic victory"),confirm=True,note="Proposed number; was issued as SYS-0003 in September. Could also sit in NRG.")
e("CCR-DIP-0001","DIP","US–Iran Memorandum of Understanding — trap configuration","2026-06","Provisional","public","A draft diplomatic instrument read as a liminal trap: pervasive deferral, status-quo freeze, reversibility asymmetry.")
e("CCR-DIP-0002","DIP","US–Iran Memorandum of Understanding — seam configuration","2026-06","Provisional","public","The same instrument read as a seam: proportionality, an executive mechanism and UN Security Council reincorporation.")

DOM = {"URB":U("Architecture & urban","Architektur & Stadt","Αρχιτεκτονική & πόλη"),"MFG":U("Manufacturing","Fertigung","Παραγωγή"),
       "SEC":U("Security","Sicherheit","Ασφάλεια"),"CCU":U("Climate technology","Klimatechnik","Κλιματική τεχνολογία"),
       "SYS":U("AI & systems","KI & Systeme","ΤΝ & συστήματα"),"NRG":U("Energy","Energie","Ενέργεια"),
       "DIP":U("Diplomacy","Diplomatie","Διπλωματία"),"ADM":U("Administration","Verwaltung","Διοίκηση")}
meta = {"name":"CCR Library","publisher":"Triact","framework":"P·L·T (Polycontexturality · Liminality · Transjunction), created by Alexander Tsigkas","updated":"2026-11-24","domains":DOM}

here = os.path.dirname(os.path.abspath(__file__))
# Private entries (e.g. competition dossiers) live in private.json, which is never committed.
priv_path = os.path.join(here, "private.json")
if os.path.exists(priv_path):
    E += json.load(open(priv_path))["entries"]
safe = [x for x in E if x["visibility"] != "private"]
json.dump(dict(meta, entries=safe), open(os.path.join(here,"registry.json"),"w"), ensure_ascii=False, indent=1)
out = os.environ.get("PRIVATE_OUT")
if out:
    json.dump(dict(meta, entries=E), open(out,"w"), ensure_ascii=False, indent=1)
print(len(E), "entries;", len(safe), "in registry.json")
