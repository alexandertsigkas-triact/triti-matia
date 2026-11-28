"""
The official CCR registry (adopted 24 Nov 2026), rebuilt from the 9 Nov 2026 master register.
This file is the source of record: add new entries here.
Run:  python3 build_registry.py
Writes registry.json (public and anonymised entries only; safe for the public repository).
Private entries go in private.json (not committed); with PRIVATE_OUT set, a full file for the server is written too.
"""
import json, os
E = []
def e(id, domain, title, date, status, visibility, summary="", aliases=(), signature=None, verdict=None, gate=None, kind="Case", note="", confirm=False, contextures=(), tool=None):
    E.append(dict(id=id, aliases=list(aliases), domain=domain, title=title, date=date, status=status, visibility=visibility,
                  kind=kind, signature=signature, verdict=verdict, gate=gate, summary=summary, note=note, numberToConfirm=confirm, contextures=list(contextures), tool=tool, source="full entry" if contextures else "summary only"))
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
e("CCR-NRG-0001","NRG","Synchrony Refused, Connection Kept — SAFEr Grid","2026-11-07","Provisional","public","SAFEr Grid (ERC Synergy, RWTH Aachen/Aalborg) replaces the synchronous 50 Hz balance of power with store-and-forward balancing of energy between decoupled subgrids. One carrier, grid frequency, is made to serve four contextures that do not share a logic; the project turns frequency from operator into operand. Certified third technically, uncertified institutionally.",
  contextures=["K₁ Synchronous-electromechanical","K₂ Inverter-based renewable","K₃ Informational (Internet, telecom)","K₄ Institutional (operators, markets, regulation)"],
  signature=U("Synchrony refused, connection kept","Synchronie verweigert, Verbindung bewahrt","Συγχρονία αρνημένη, σύνδεση διατηρημένη"),
  verdict={"class":"conditional","en":"Certified (technical) · uncertified (institutional)"},gate={"od":"~4","r":["Pass","Pass","Conditional"]})
e("CCR-NRG-0002","NRG","Where Compute Can Return — Kozani data centre","2026-11-08","Provisional","public","PPC data centre (300 MW, AWS lease) at the closed Agios Dimitrios lignite plant, Kozani. The right site (fit 12/15) with a configuration that returns too little (6/15, reciprocity 0.5), above all heat: 41 °C waste heat offered to greenhouses while the town lost its district heating. OD 4.",
  contextures=['K₁ Grid and energy', 'K₂ Digital', 'K₃ Thermal and water', 'K₄ Local community', 'K₅ Regulation'],tool="CCR-NRG site-scoring sheet (fit, return, tension, OD, reciprocity, three refusals)",
  signature=U("The right ground, the wrong temperature","Der richtige Ort, die falsche Temperatur","Ο σωστός τόπος, η λάθος θερμοκρασία"),
  verdict={"class":"uncertified","en":"Uncertified as announced; conditional if reconfigured"},gate={"od":4,"fit":12,"ret":6,"r":["Conditional","Fail","Conditional"]})
e("CCR-NRG-0003","NRG","The Right Temperature, the Wrong Ground — Amsterdam-Zuidoost","2026-11-08","Provisional","public","Equinix campus at Amstel III, Amsterdam-Zuidoost: a weak site (fit 6/15) with a comparatively generous configuration (return 8/15, free residual heat). Grid congested until about 2036, scarce water, 5,500–8,000 homes planned on the same grid, a grandfathered permit despite the 2025 moratorium. Mirror image of Kozani. OD 5.",
  contextures=['K₁ Grid and energy', 'K₂ Digital', 'K₃ Thermal and water', 'K₄ Local community', 'K₅ Regulation'],tool="CCR-NRG site-scoring sheet",
  signature=U("The right temperature, the wrong ground","Die richtige Temperatur, der falsche Ort","Η σωστή θερμοκρασία, ο λάθος τόπος"),
  verdict={"class":"uncertified","en":"Uncertified"},gate={"od":5,"fit":6,"ret":8,"r":["Fail","Conditional","Fail"]})
# Entries from earlier chats whose numbers clash or were never added to the master register.
e("CCR-SYS-0004","SYS","Canvas als Prompt — the whole canvas as a prompt","2026-09","Provisional","public","A vendor claim that fuses team, tool and prompt logics into one surface: conjunction sold as synthesis.",
  aliases=["CCR-SYS-0002 (Sept 2026)"],note="Renumbered 24 Nov 2026; issued as SYS-0002 in September.")
e("CCR-SYS-0005","SYS","Swiss nuclear new-build referendum","2026-09","Provisional","public","A yes/no ballot that can register only political legitimacy while supply security, decarbonisation and capital stay blocked.",
  aliases=["CCR-SYS-0003 (Sept 2026)"],signature=U("Every outcome a Pyrrhic victory"),note="Renumbered 24 Nov 2026; issued as SYS-0003 in September.")
e("CCR-DIP-0001","DIP","US–Iran Memorandum of Understanding — trap configuration","2026-06","Provisional","public","A draft diplomatic instrument read as a liminal trap: pervasive deferral, status-quo freeze, reversibility asymmetry.")
e("CCR-DIP-0002","DIP","US–Iran Memorandum of Understanding — seam configuration","2026-06","Provisional","public","The same instrument read as a seam: proportionality, an executive mechanism and UN Security Council reincorporation.")

# Registered 28 Nov 2026 (decided by Alexander Tsigkas). Summary-only entries; full details to be added.
# CCR-URB-0010 (ANAKTORA), CCR-ADM-0010 (ANAKTORA team reading) and CCR-ADM-0011 (individual portfolio) are private: not in this file.
e("CCR-URB-0011","URB","Archontiko Athina and the tobacco warehouses of Xanthi","","Final","public","Core case study: the Archontiko Athina and the tobacco warehouses of Xanthi.")
e("CCR-URB-0012","URB","The kyfi of Halki","","Final","public","Core case study: the kyfi of Halki.")
e("CCR-URB-0013","URB","Salon interior — refusal case","","Provisional","public","An interior where the analysis ended in refusal.",gate={"od":"~2"},note="Refusal case.")
e("CCR-SYS-0006","SYS","IBM Maximo 9.1","2026-11","Provisional","public","The IBM Maximo 9.1 asset-management platform; basis of the capstone 'Repair or Replace?'.")
e("CCR-SYS-0007","SYS","ZERO AI-infrastructure governance","2026-11","Provisional","public","The ZERO governance framework for AI infrastructure (with Maria Kollia), read with P·L·T.")
e("CCR-SYS-0008","SYS","Multi-agent AI debate system","","Provisional","public","A multi-agent AI debate system, read with P·L·T.")
e("CCR-SYS-0009","SYS","Gioia methodology","","Provisional","public","The Gioia qualitative research methodology, read with P·L·T.",kind="Analysis of a method")
e("CCR-ADM-0001","ADM","Promise vs. capacity — Order-to-promise","2026-06","Provisional","public","Order-to-promise (Makigami simulator): promise and speed (sales) vs load and capacity (planning). Third: a commitment desk holding available-to-promise: every quote is checked against booked capacity before it becomes a promise.",contextures=["K₁ promise and speed (sales)","K₂ load and capacity (planning)"],gate={"od":4},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0002","ADM","Spec freeze vs. late change — Order-to-promise","2026-06","Provisional","public","Order-to-promise (Makigami simulator): lock the order vs accommodate the customer. Third: a change desk: late changes are costed and re-promised, never silently absorbed onto the floor.",contextures=["K₁ lock the order","K₂ accommodate the customer"],gate={"od":3},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0003","ADM","Replan vs. commit — Order-to-promise","2026-06","Provisional","public","Order-to-promise (Makigami simulator): re-optimise the schedule vs honour the date given. Third: a frozen zone: inside the fence the promised date is immovable, outside it the plan re-optimises freely.",contextures=["K₁ re-optimise the schedule","K₂ honour the date given"],gate={"od":3},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0004","ADM","Speed vs. due process — Intake-to-triage","2026-06","Provisional","public","Intake-to-triage (Makigami simulator): clear the queue fast vs don't miss the serious case. Third: an escalation cell: low-risk is auto-routed, a risk signal lifts the case out of the fast lane into reviewed handling.",contextures=["K₁ clear the queue fast","K₂ don't miss the serious case"],gate={"od":4},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0005","ADM","Generalist vs. specialist — Intake-to-triage","2026-06","Provisional","public","Intake-to-triage (Makigami simulator): whoever is free takes it vs right skill for the case. Third: a skills-matched triage: routing weighted by case complexity, not just availability.",contextures=["K₁ whoever is free takes it","K₂ right skill for the case"],gate={"od":3},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0006","ADM","Close vs. document — Intake-to-triage","2026-06","Provisional","public","Intake-to-triage (Makigami simulator): close the case, free the slot vs complete the record for audit. Third: a closure gate: the case cannot close until the audit-minimum record is present.",contextures=["K₁ close the case, free the slot","K₂ complete the record for audit"],gate={"od":3},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0007","ADM","Discretion vs. standardisation — Permit-to-approve","2026-06","Provisional","public","Permit-to-approve (Makigami simulator): local judgement on the file vs uniform rule across files. Third: a pre-check: a standard checklist clears routine files; only genuinely novel files reach discretionary review.",contextures=["K₁ local judgement on the file","K₂ uniform rule across files"],gate={"od":4},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0008","ADM","Conditions vs. approval — Permit-to-approve","2026-06","Provisional","public","Permit-to-approve (Makigami simulator): approve to keep the queue moving vs hold until conditions are met. Third: conditional approval as a third state: issued but fenced, valid once dated conditions are signed off.",contextures=["K₁ approve to keep the queue moving","K₂ hold until conditions are met"],gate={"od":3},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0009","ADM","Speed vs. documentation — Permit-to-approve","2026-06","Provisional","public","Permit-to-approve (Makigami simulator): issue the permit vs complete the justification. Third: a justification template generated from the decision itself: the record is a by-product of deciding.",contextures=["K₁ issue the permit","K₂ complete the justification"],gate={"od":3},note="Restored 28 Nov 2026 from the Makigami simulator of June 2026.")
e("CCR-ADM-0012","ADM","Nova Insurance — teaching model case","2026-11","Provisional","public","Model case for the course 'AI, Complexity and Leading in Transition'.",kind="Teaching case")
e("CCR-ADM-0013","ADM","Business methodology pilot (client, anonymised)","2026-09","Provisional","anonymise","A business methodology pilot on a process platform, read with P·L·T.")
e("CCR-RSA-0001","RSA","Fix or tow — make-safe and book","2026-06","Provisional","public","Roadside assistance, future state: mobility now (fix on site, avoid tow cost) vs proper repair and safety. The binary is refused: make the vehicle safe and book a proper repair. Analogue of the SOFMAN offcut store.",contextures=["K₁ mobility now","K₂ proper repair and safety"],gate={"od":4},note="Restored 28 Nov 2026 from the June 2026 VSM work; cited in the steel-fabrication reading guide.")
e("CCR-RSA-0002","RSA","Intake routing — self-service and duty of care","2026-06","Provisional","public","Roadside assistance intake: self-service efficiency vs duty of care. Self-service by default, escalation to a person on a risk signal.",contextures=["K₁ self-service and cost","K₂ duty of care"],gate={"od":3},note="Restored 28 Nov 2026 from the June 2026 VSM work.")
e("CCR-RSA-0003","RSA","Fleet positioning — utilisation and reserve","2026-06","Provisional","public","Roadside assistance fleet: utilisation vs resilience reserve. A reserve that is deployed but releasable: useful now, released on the surge.",contextures=["K₁ utilisation","K₂ resilience reserve"],gate={"od":3},note="Restored 28 Nov 2026 from the June 2026 VSM work.")
e("CCR-LAW-0001","LAW","Pinochet No 2","","Provisional","public","The House of Lords setting aside its own judgment for apparent bias (1999), read with P·L·T.")
e("CCR-LAW-0002","LAW","BVerfG PSPP judgment","","Provisional","public","The German Federal Constitutional Court's 2020 PSPP judgment on ECB bond purchases, read with P·L·T.")
e("CCR-LAW-0003","LAW","Morandi bridge verdict, Genoa","","Provisional","public","The verdict on the collapse of the Morandi bridge in Genoa, read with P·L·T.")
e("CCR-LAW-0004","LAW","CJEU Pelham — Kraftwerk sampling","","Provisional","public","The CJEU Pelham judgment on sampling Kraftwerk's 'Metall auf Metall', read with P·L·T.")
e("CCR-HIS-0001","HIS","Messinia","2026-11","Provisional","public","First case in retrospective (historical) mode.",kind="Retrospective case")
e("CCR-ENV-0001","ENV","Emscher river","2026-11","Provisional","public","The Emscher river as a nature-based solution, read with P·L·T; co-authored paper in preparation.")

DOM = {"URB":U("Architecture & urban","Architektur & Stadt","Αρχιτεκτονική & πόλη"),"MFG":U("Manufacturing","Fertigung","Παραγωγή"),
       "SEC":U("Security","Sicherheit","Ασφάλεια"),"CCU":U("Climate technology","Klimatechnik","Κλιματική τεχνολογία"),
       "SYS":U("AI & systems","KI & Systeme","ΤΝ & συστήματα"),"NRG":U("Energy","Energie","Ενέργεια"),
       "DIP":U("Diplomacy","Diplomatie","Διπλωματία"),"ADM":U("Administration","Verwaltung","Διοίκηση"),
       "LAW":U("Law","Recht","Δίκαιο"),"HIS":U("History","Geschichte","Ιστορία"),"ENV":U("Environment","Umwelt","Περιβάλλον"),
       "RSA":U("Roadside assistance","Pannenhilfe","Οδική βοήθεια")}
meta = {"name":"CCR Library","publisher":"Triact","framework":"P·L·T (Polycontexturality · Liminality · Transjunction), created by Alexander Tsigkas","updated":"2026-11-28","domains":DOM}

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
