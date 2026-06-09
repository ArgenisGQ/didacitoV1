import hashlib
import re
from datetime import datetime
import fitz  # PyMuPDF


def calculate_sha256(file_bytes: bytes) -> str:
    """Calculate SHA-256 hash of a file's bytes to detect duplicates."""
    hasher = hashlib.sha256()
    hasher.update(file_bytes)
    return hasher.hexdigest()


def clean_extracted_text(text: str) -> str:
    """Basic text cleanup."""
    if not text:
        return ""
    # Remove multiple spaces and preserve sensible newlines
    text = re.sub(r'[ \t]+', ' ', text)
    # Remove leading/trailing spaces on lines
    lines = [line.strip() for line in text.split('\n')]
    return '\n'.join(lines).strip()


def clean_short_field(text: str) -> str:
    """Cleans short text fields by collapsing all whitespace to a single space."""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()


def clean_paragraph_text(text: str) -> str:
    """
    Cleans up text extracted from PDF fields.
    Joins words split by newlines, removes multiple spaces,
    and formats them into readable paragraphs.
    """
    if not text:
        return ""
    
    # Normalize tabs and spaces
    text = re.sub(r'[ \t]+', ' ', text)
    
    # Pre-process: detect pathological word-per-line patterns from PyMuPDF extraction.
    # If most blocks between blank lines are just 1-2 words, collapse all blank lines
    # into single newlines so the line-joining logic below can reconstruct paragraphs.
    blocks = [b.strip() for b in re.split(r'\n\s*\n', text) if b.strip()]
    if len(blocks) > 3:
        short_block_count = sum(1 for b in blocks if len(b.split()) <= 2)
        if short_block_count / len(blocks) > 0.5:
            text = re.sub(r'\n\s*\n', '\n', text)
    
    # Split into lines
    lines = text.split('\n')
    
    cleaned_paragraphs = []
    current_para = []
    
    for line in lines:
        line_str = line.strip()
        if not line_str:
            if current_para:
                cleaned_paragraphs.append(" ".join(current_para))
                current_para = []
            continue
            
        # Check if line starts with a list bullet, or list number/letter
        is_bullet = (
            re.match(r'^([-*•+o✓]|\d+\.|\w\))\s', line_str) is not None
            or re.match(r'^(TEMA|UNIDAD|SECCIÓN|CAPÍTULO)\s+\w+', line_str, re.IGNORECASE) is not None
        )
        
        if is_bullet:
            if current_para:
                cleaned_paragraphs.append(" ".join(current_para))
                current_para = []
            cleaned_paragraphs.append(line_str)
        else:
            if current_para and current_para[-1].endswith('-'):
                current_para[-1] = current_para[-1][:-1] + line_str
            else:
                current_para.append(line_str)
                
    if current_para:
        cleaned_paragraphs.append(" ".join(current_para))
        
    result = []
    for p in cleaned_paragraphs:
        p_clean = re.sub(r'\s+', ' ', p).strip()
        if p_clean:
            result.append(p_clean)
            
    return "\n\n".join(result)



def parse_syllabus_pdf(file_bytes: bytes, filename: str = "") -> dict:
    """
    Parses a Universidad Yacambú syllabus PDF using PyMuPDF (fitz) and regex.
    Returns a dictionary of structured data.
    """
    file_hash = calculate_sha256(file_bytes)
    
    # 1. Open document and extract text
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    
    clean_text = clean_extracted_text(full_text)
    
    # 2. Extract code and name from filename as initial fallback
    # Example: "Aprender Sirviendo a la Comunidad (TAA-0600).pdf"
    fallback_code = ""
    fallback_name = ""
    if filename:
        fn_match = re.search(r'([^(]+)\(([^)]+)\)', filename)
        if fn_match:
            fallback_name = fn_match.group(1).strip()
            fallback_code = fn_match.group(2).replace(".pdf", "").strip()
        else:
            fallback_name = filename.replace(".pdf", "").strip()

    # 3. Apply Heuristics to find structured fields in text
    
    # --- Unidad Curricular (Subject Name) ---
    subject_name = fallback_name
    name_match = re.search(r'UNIDAD CURRICULAR\n+([^\n]+)', full_text, re.IGNORECASE)
    if name_match:
        subject_name = name_match.group(1).strip()
    
    # --- Code ---
    subject_code = fallback_code
    ident_match = re.search(r'IDENTIFICACION(.*?)(?=PRELACION|$)', full_text, re.IGNORECASE | re.DOTALL)
    if ident_match:
        ident_text = ident_match.group(1)
        code_match = re.search(r'\b([A-Z]{3,4}-\d{3,5})\b', ident_text)
        if code_match:
            subject_code = code_match.group(1).strip()
        elif not subject_code:
            code_match_no_hyphen = re.search(r'\b([A-Z]{3,4}\d{3,5})\b', ident_text)
            if code_match_no_hyphen:
                c = code_match_no_hyphen.group(1)
                subject_code = f"{c[:3]}-{c[3:]}" if len(c) >= 7 else f"{c[:4]}-{c[4:]}"
                
    if not subject_code or not re.match(r'^[A-Z]{3,4}-\d{3,5}$', subject_code):
        code_match = re.search(r'\b([A-Z]{3,4}-\d{3,5})\b', full_text)
        if code_match:
            subject_code = code_match.group(1).strip()
        elif not subject_code:
            # Try finding code without hyphen (e.g. TAA0600)
            code_match_no_hyphen = re.search(r'\b([A-Z]{3,4}\d{3,5})\b', full_text)
            if code_match_no_hyphen:
                c = code_match_no_hyphen.group(1)
                subject_code = f"{c[:3]}-{c[3:]}" if len(c) >= 7 else f"{c[:4]}-{c[4:]}"
            
    # --- Document Code (e.g., FOR-VRA120-060723-316) ---
    doc_code = ""
    doc_match = re.search(r'\b(FOR-VRA\d+-\d+-\d+)\b', full_text)
    if doc_match:
        doc_code = doc_match.group(1).strip()
    
    # --- Program (Carrera) ---
    program = ""
    prog_match = re.search(r'LICENCIATURA EN\s+([^\n]+)', full_text, re.IGNORECASE)
    if prog_match:
        program = f"LICENCIATURA EN {prog_match.group(1).strip()}"
    else:
        # Fallback to lines below Programas de Formación
        pf_match = re.search(r'PROGRAMAS DE FORMACION\s*\n+([^\n]+)', full_text, re.IGNORECASE)
        if pf_match:
            program = pf_match.group(1).strip()

    # --- Level (PREGRADO / POSTGRADO) ---
    level = "PREGRADO"
    if "POSTGRADO" in full_text.upper() and ("POSTGRADO\n*X" in full_text.upper() or "POSTGRADO X" in full_text.upper()):
        level = "POSTGRADO"
    elif "PREGRADO" in full_text.upper():
        level = "PREGRADO"

    # --- Version and Date ---
    version_year = "2024"
    ver_match = re.search(r'VERSION\s+(\d{4})', full_text, re.IGNORECASE)
    if ver_match:
        version_year = ver_match.group(1).strip()
        
    ident_date = None
    date_match = re.search(r'FECHA\s+(\d{2}[-/]\d{2}[-/]\d{4})', full_text, re.IGNORECASE)
    if date_match:
        date_str = date_match.group(1).strip().replace('/', '-')
        try:
            ident_date = datetime.strptime(date_str, "%d-%m-%Y").date()
        except Exception:
            pass

    # --- Hours, Credits and Period ---
    academic_credits = 0
    had_hours = 0
    hde_hours = 0
    hts_hours = 0
    academic_period = None

    # Let's search for values near the subject code in a tabular format
    # Typically: CODE CREDITS HAD HDE HTS PERIOD
    # E.g. TAA-0600  0   0   0   0   7
    if subject_code:
        # Escape code for regex
        esc_code = re.escape(subject_code)
        tab_match = re.search(rf'{esc_code}\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)', full_text)
        if tab_match:
            academic_credits = int(tab_match.group(1))
            had_hours = int(tab_match.group(2))
            hde_hours = int(tab_match.group(3))
            hts_hours = int(tab_match.group(4))
            academic_period = int(tab_match.group(5))
        else:
            # Fallback regex that looks for numbers in identification
            cred_match = re.search(r'CREDITOS ACADEMICOS\s*\n*(\d+)', full_text, re.IGNORECASE)
            if cred_match:
                academic_credits = int(cred_match.group(1))

    # --- Prerequisite (Prelación) ---
    prerequisite = ""
    prel_match = re.search(r'PRELACION\s*\n+([^\n]+)', full_text, re.IGNORECASE)
    if prel_match:
        prerequisite = prel_match.group(1).strip()
        if prerequisite.upper().startswith("CORRESPONDENCIAS"):
            prerequisite = ""

    # --- Presentation, Purpose, Competencies ---
    def extract_between(start_pat, end_pat, text_source):
        start_match = re.search(start_pat, text_source, re.IGNORECASE)
        if not start_match:
            return ""
        start_idx = start_match.end()
        end_match = re.search(end_pat, text_source[start_idx:], re.IGNORECASE)
        if end_match:
            return text_source[start_idx:start_idx + end_match.start()].strip()
        return text_source[start_idx:start_idx + 1000].strip() # safety limit

    presentation = extract_between(r'PRESENTACION\s*\n', r'PROPOSITO DE LA UNIDAD CURRICULAR', full_text)
    purpose = extract_between(r'PROPOSITO DE LA UNIDAD CURRICULAR\s*\n', r'COMPETENCIAS PREVIAS', full_text)
    previous_competencies = extract_between(r'COMPETENCIAS PREVIAS\s*\n', r'COMPETENCIAS GENERICAS', full_text)
    generic_competencies = extract_between(r'COMPETENCIAS GENERICAS\s*\n', r'RELACION CON OTRAS UNIDADES|ESTRUCTURA DE LAS UNIDADES', full_text)
    relation_other_subjects = extract_between(r'RELACION CON OTRAS UNIDADES CURRICULARES\s*\n', r'ESTRUCTURA DE LAS UNIDADES', full_text)
    teaching_strategies = extract_between(r'ESTRIGIAS DIDACTICAS|ESTRATEGIAS DIDACTICAS\s*\n', r'ESTRATEGIAS DE EVALUACION', full_text)

    # --- Evaluation strategies ---
    eval_diagnostica = ""
    eval_formativa = ""
    eval_sumativa = ""
    
    start_page_idx = -1
    start_y = 0
    end_page_idx = -1
    end_y = 999999
    
    for idx, page in enumerate(doc):
        blocks = page.get_text("blocks")
        for b in blocks:
            text = b[4].strip()
            if "ESTRATEGIAS DE EVALUACION" in text:
                start_page_idx = idx
                start_y = b[1]
            if "REFERENCIAS BIBLIOGRAFICAS" in text:
                end_page_idx = idx
                end_y = b[1]
                
    if start_page_idx != -1:
        eval_diag_lines = []
        eval_form_lines = []
        eval_sum_lines = []
        
        max_idx = end_page_idx if end_page_idx != -1 else len(doc) - 1
        for idx in range(start_page_idx, max_idx + 1):
            page = doc[idx]
            blocks = page.get_text("blocks")
            sorted_blocks = sorted(blocks, key=lambda x: x[1])
            
            for b in sorted_blocks:
                if idx == start_page_idx and b[1] <= start_y:
                    continue
                if idx == end_page_idx and b[1] >= end_y:
                    continue
                    
                text_clean = b[4].strip().replace('\n', ' ')
                if re.match(r'^(Diagnostica\s+Formativa\s+Sumativa|Diagnostica|Formativa|Sumativa)$', text_clean, re.IGNORECASE):
                    continue
                    
                x0 = b[0]
                if x0 < 200:
                    eval_diag_lines.append(b[4].strip())
                elif 200 <= x0 < 380:
                    eval_form_lines.append(b[4].strip())
                else:
                    eval_sum_lines.append(b[4].strip())
                    
        eval_diagnostica = " ".join(eval_diag_lines)
        eval_formativa = " ".join(eval_form_lines)
        eval_sumativa = " ".join(eval_sum_lines)

    # --- Bibliography ---
    bibliographic_references = ""
    bib_idx = re.search(r'REFERENCIAS BIBLIOGRAFICAS', full_text, re.IGNORECASE)
    if bib_idx:
        bibliographic_references = full_text[bib_idx.end():].strip()

    # --- Correspondences ---
    # Disabled by user request: do not parse/save correspondences data
    correspondences = []

    # --- Learning Units ---
    units_dict = {}
    
    # 1. Parse ESTRUCTURA DE LAS UNIDADES DE APRENDIZAJE using block coordinates
    est_page_idx = -1
    est_y = 0
    dev_page_idx = -1
    dev_y = 999999
    
    for idx, page in enumerate(doc):
        blocks = page.get_text("blocks")
        for b in blocks:
            text = b[4].strip()
            if "ESTRUCTURA DE LAS UNIDADES" in text:
                if est_page_idx == -1:
                    est_page_idx = idx
                    est_y = b[1]
            if "DESARROLLO DE LAS UNIDADES" in text:
                if dev_page_idx == -1:
                    dev_page_idx = idx
                    dev_y = b[1]
                
    if est_page_idx != -1:
        unit_titles = {}
        unit_contents = {}
        current_unit = None
        
        max_idx = dev_page_idx if dev_page_idx != -1 else len(doc) - 1
        for idx in range(est_page_idx, max_idx + 1):
            page = doc[idx]
            blocks = page.get_text("blocks")
            sorted_blocks = sorted(blocks, key=lambda x: (x[1], x[0]))
            
            for b in sorted_blocks:
                if idx == est_page_idx and b[1] <= est_y:
                    continue
                if idx == dev_page_idx and b[1] >= dev_y:
                    continue
                    
                text_clean = b[4].strip().replace('\n', ' ')
                unit_header_match = re.search(r'\b(Unidad\s+[IVXLCDM\d]+)\b', text_clean, re.IGNORECASE)
                if unit_header_match:
                    current_unit = unit_header_match.group(1).upper()
                    if current_unit not in unit_titles:
                        unit_titles[current_unit] = []
                    if current_unit not in unit_contents:
                        unit_contents[current_unit] = []
                    
                    text_without_header = re.sub(r'\bUnidad\s+[IVXLCDM\d]+\b', '', text_clean, flags=re.IGNORECASE)
                    text_without_header = re.sub(r'CONTENIDOS', '', text_without_header, flags=re.IGNORECASE).strip()
                    if text_without_header:
                        x0 = b[0]
                        if x0 < 200:
                            unit_titles[current_unit].append(text_without_header)
                        else:
                            unit_contents[current_unit].append(text_without_header)
                    continue
                    
                if current_unit:
                    if text_clean.upper() == "CONTENIDOS":
                        continue
                    x0 = b[0]
                    if x0 < 200:
                        unit_titles[current_unit].append(text_clean)
                    else:
                        unit_contents[current_unit].append(text_clean)
                        
        for unit_num, titles in unit_titles.items():
            clean_num = clean_short_field(unit_num)
            clean_title = clean_short_field(" ".join(titles))
            clean_cont = clean_paragraph_text(" ".join(unit_contents.get(unit_num, [])))
            units_dict[clean_num] = {
                "unit_number": clean_num,
                "unit_title": clean_title,
                "contents": clean_cont,
                "performance_criteria": ""
            }

    # 2. Parse DESARROLLO DE LAS UNIDADES DE APRENDIZAJE for performance criteria using block coordinates
    dev_page_idx = -1
    dev_y = 0
    didacticas_page_idx = -1
    didacticas_y = 999999
    
    for idx, page in enumerate(doc):
        blocks = page.get_text("blocks")
        for b in blocks:
            text = b[4].strip()
            if "DESARROLLO DE LAS UNIDADES" in text:
                if dev_page_idx == -1:
                    dev_page_idx = idx
                    dev_y = b[1]
            if "ESTRATEGIAS DIDACTICAS" in text or "ESTRIGIAS DIDACTICAS" in text or "ESTRATEGIAS DE EVALUACION" in text or "REFERENCIAS BIBLIOGRAFICAS" in text:
                if dev_page_idx != -1 and idx >= dev_page_idx:
                    if didacticas_page_idx == -1 or idx < didacticas_page_idx or (idx == didacticas_page_idx and b[1] < didacticas_y):
                        didacticas_page_idx = idx
                        didacticas_y = b[1]

    if dev_page_idx != -1:
        dev_left = {}
        dev_right = {}
        current_unit = None
        
        max_idx = didacticas_page_idx if didacticas_page_idx != -1 else len(doc) - 1
        for idx in range(dev_page_idx, max_idx + 1):
            page = doc[idx]
            blocks = page.get_text("blocks")
            sorted_blocks = sorted(blocks, key=lambda x: (x[1], x[0]))
            
            for b in sorted_blocks:
                if idx == dev_page_idx and b[1] <= dev_y:
                    continue
                if idx == didacticas_page_idx and b[1] >= didacticas_y:
                    continue
                    
                text_clean = b[4].strip().replace('\n', ' ')
                unit_match = re.search(r'\b(UNIDAD\s+[IVXLCDM\d]+)\b', text_clean, re.IGNORECASE)
                if unit_match:
                    current_unit = unit_match.group(1).upper()
                    if current_unit not in dev_left:
                        dev_left[current_unit] = []
                    if current_unit not in dev_right:
                        dev_right[current_unit] = []
                    continue
                    
                if current_unit:
                    upper_text = text_clean.upper()
                    if "CRITERIOS DE DESEMPEÑO" in upper_text or "COMPETENCIA DE LA UNIDAD" in upper_text or "DESARROLLO DE LAS UNIDADES" in upper_text or "ESTRUCTURA DE LAS UNIDADES" in upper_text:
                        continue
                    
                    x0 = b[0]
                    if x0 < 250:
                        dev_left[current_unit].append(text_clean)
                    else:
                        dev_right[current_unit].append(text_clean)
                        
        for unit_num, lefts in dev_left.items():
            clean_num = clean_short_field(unit_num)
            left_str = clean_paragraph_text(" ".join(lefts))
            right_str = clean_paragraph_text(" ".join(dev_right.get(unit_num, [])))
            
            parts = []
            if left_str:
                parts.append(f"Competencia:\n{left_str}")
            if right_str:
                parts.append(f"Criterios de Desempeño:\n{right_str}")
            
            clean_crit = "\n\n".join(parts)
            
            if clean_num in units_dict:
                units_dict[clean_num]["performance_criteria"] = clean_crit
            else:
                units_dict[clean_num] = {
                    "unit_number": clean_num,
                    "unit_title": "",
                    "contents": "",
                    "performance_criteria": clean_crit
                }
                
    units = list(units_dict.values())

    # Apply cleanup to all fields before returning
    subject_code = clean_short_field(subject_code)
    subject_name = clean_short_field(subject_name)
    doc_code = clean_short_field(doc_code)
    program = clean_short_field(program)
    prerequisite = clean_short_field(prerequisite)
    
    presentation = clean_paragraph_text(presentation)
    purpose = clean_paragraph_text(purpose)
    previous_competencies = clean_paragraph_text(previous_competencies)
    generic_competencies = clean_paragraph_text(generic_competencies)
    relation_other_subjects = clean_paragraph_text(relation_other_subjects)
    teaching_strategies = clean_paragraph_text(teaching_strategies)
    
    eval_diagnostica = clean_paragraph_text(eval_diagnostica)
    eval_formativa = clean_paragraph_text(eval_formativa)
    eval_sumativa = clean_paragraph_text(eval_sumativa)
    bibliographic_references = clean_paragraph_text(bibliographic_references)

    # Return complete dictionary
    return {
        "code": subject_code,
        "name": subject_name,
        "document_code": doc_code,
        "program": program,
        "level": level,
        "identification_date": ident_date,
        "syllabus_version_year": version_year,
        "academic_credits": academic_credits,
        "had_hours": had_hours,
        "hde_hours": hde_hours,
        "hts_hours": hts_hours,
        "academic_period": academic_period,
        "prerequisite": prerequisite,
        "presentation": presentation,
        "purpose": purpose,
        "previous_competencies": previous_competencies,
        "generic_competencies": generic_competencies,
        "relation_other_subjects": relation_other_subjects,
        "teaching_strategies": teaching_strategies,
        "eval_diagnostica": eval_diagnostica,
        "eval_formativa": eval_formativa,
        "eval_sumativa": eval_sumativa,
        "bibliographic_references": bibliographic_references,
        "file_hash": file_hash,
        "extracted_text": clean_text,
        "units": units,
        "correspondences": correspondences
    }

