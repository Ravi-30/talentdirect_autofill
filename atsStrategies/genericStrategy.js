/**
 * genericStrategy.js
 * Default strategy for applying resume data to standard job application forms.
 */
class GenericStrategy {
    constructor() {
        this.CONFIDENCE_THRESHOLD = 70;

        // Field Mapping Dictionary
        this.FIELD_MAPPING = {
            "identity.first_name": ["first_name", "first name", "fname", "given name"],
            "identity.last_name": ["last_name", "last name", "lname", "surname", "family name"],
            "identity.full_name": ["name", "fullname", "full_name", "applicant name"],
            "contact.email": ["email", "e-mail", "mail", "email address"],
            "contact.phone": ["phone", "tel", "mobile", "cell", "contact", "phone number"],
            "contact.portfolio": ["website", "url", "portfolio", "link", "personal website"],
            "contact.address": ["address", "street", "address line 1"],
            "contact.city": ["city", "town"],
            "contact.zip_code": ["zip", "postal", "code", "zip code"],
            "contact.state": ["state", "province", "region"],
            "contact.country": ["country", "country format"],
            "contact.linkedin": ["linkedin", "linkedin url", "linkedin profile"],
            "contact.github": ["github", "github profile", "github url"],
            "summary.short": ["summary", "about", "bio", "description"],
            "summary.professional_statement": ["describe your relevant experiences", "professional statement", "highlight your industrial projects", "research record", "relevant experiences", "industrial projects", "3-4 sentences", "highlight your projects", "highlight your industrial projects and research record"],
            "summary.motivation": ["multiple roles", "motivation for each", "order them", "apply to multiple roles", "explain your motivation"],
            "employment.current_role": ["job title", "current role", "current title", "position title"],
            "employment.current_company": ["company", "employer", "current company", "organization"],
            "employment.years_total": ["total years of experience", "total years experience", "number of years", "years of relevant experience"],
            "employment.work_description": ["responsibilities", "work description", "job description", "summary", "description", "work highlights"],
            "employment.start_date": ["work start", "employment start", "job start", "start date"],
            "employment.end_date": ["work end", "employment end", "job end", "end date"],
            // Dropdown specific / Additional fields
            "education_flat.degree": ["degree", "level of education", "educational attainment"],
            "education_flat.institution": ["school", "university", "college", "institution"],
            "education_flat.major": ["major", "field of study", "specialization", "discipline"],
            "education_flat.start_date": ["education start", "edu start", "graduation date", "education start date"],
            "education_flat.end_date": ["education end", "edu end", "graduation date", "education end date"],
            "identity.gender": ["gender", "sex"],
            "identity.ethnicity": ["ethnicity", "race", "hispanic"],
            "identity.hispanic_latino": ["hispanic", "latino"],
            "identity.veteran_status": ["veteran", "military"],
            "identity.disability_status": ["disability", "handicap", "voluntary self-identification"],
            "identity.sponsorship_required": ["sponsorship", "visa", "work authorization", "authorized to work", "need sponsorship", "legal right to work"],
            "availability.start_date": ["start date", "availability", "soonest start", "available to start", "soonest", "soonest you can start"],
            "summary.onsite_sunnyvale": ["sunnyvale", "on-site", "work on-site", "sunnyvale office", "location", "sunnyvale, ca office"]
        };
    }


    getNestedValue(obj, path) {
        if (!obj || !path) return null;
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    handleFileUpload(resumeFile) {
        if (!resumeFile || !resumeFile.data) return;

        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            const labelTxt = this.extractFeatures(input).label_text.toLowerCase();
            const containerTxt = input.closest('div, fieldset')?.innerText?.toLowerCase() || "";
            const combinedTxt = labelTxt + " " + containerTxt + " " + (input.name || "").toLowerCase() + " " + (input.id || "").toLowerCase();

            if (combinedTxt.includes("resume") || combinedTxt.includes("cv") || combinedTxt.includes("curriculum")) {
                console.log("AutoFill: Attempting to attach resume to", input.name || input.id);

                try {
                    // Convert base64 Data URL to Blob
                    const byteString = atob(resumeFile.data.split(',')[1]);
                    const mimeString = resumeFile.data.split(',')[0].split(':')[1].split(';')[0];
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: mimeString });
                    const file = new File([blob], resumeFile.name, { type: mimeString });

                    // Use DataTransfer to simulate file selection
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    input.files = dataTransfer.files;

                    // Trigger events
                    ['change', 'input', 'blur'].forEach(ev => {
                        input.dispatchEvent(new Event(ev, { bubbles: true }));
                    });
                } catch (e) {
                    console.error("AutoFill: Error attaching file", e);
                }
            }
        });
    }

    execute(normalizedData, aiEnabled, resumeFile = null) {
        console.log("Executing GenericStrategy...");

        // --- Handle Resume Attachment ---
        if (resumeFile) {
            this.handleFileUpload(resumeFile);
        }

        // --- Handle Dynamic Entry Addition ---
        const handleAddButtons = () => {
            const sections = [
                {
                    data: normalizedData.employment?.history || [],
                    selectors: ['.work-entry', '.experience-entry', 'fieldset[id*="work"]', 'div[id*="work-experience"]'],
                    btnPatterns: ['Add Experience', 'Add Work', 'Add Another', 'Add Job']
                },
                {
                    data: normalizedData.education || [],
                    selectors: ['.education-entry', 'fieldset[id*="edu"]', 'div[id*="education"]'],
                    btnPatterns: ['Add Education', 'Add School', 'Add Another']
                }
            ];

            sections.forEach(section => {
                if (section.data.length <= 1) return;

                // Count existing containers
                let containerCount = 0;
                for (const sel of section.selectors) {
                    const found = document.querySelectorAll(sel).length;
                    if (found > containerCount) containerCount = found;
                }

                if (containerCount > 0 && containerCount < section.data.length) {
                    // Try to find the "Add" button
                    const buttons = Array.from(document.querySelectorAll('button, a, span.btn, .add-btn'));
                    const addBtn = buttons.find(b => {
                        const text = b.innerText || "";
                        return section.btnPatterns.some(p => text.toLowerCase().includes(p.toLowerCase()));
                    });

                    if (addBtn) {
                        console.log(`AutoFill: Clicking "Add" button for count ${containerCount} < ${section.data.length}`);
                        addBtn.click();
                        // We click only once per execute cycle. 
                        // The MutationObserver in content.js will trigger execute() again if the DOM changes.
                    }
                }
            });
        };

        handleAddButtons();

        const inputs = document.querySelectorAll('input, textarea, select');

        // This array will hold the report data for the side panel
        let fillReport = [];

        // Track field groups to avoid filling the same entry multiple times
        let educationGroupTracker = new Map();
        let employmentGroupTracker = new Map();

        inputs.forEach(input => {
            // Allow hidden fields if they have a name or id (likely state holders for custom dropdowns)
            if (input.type === 'hidden' && !input.id && !input.name && !input.getAttribute('data-automation-id')) return;
            if (input.disabled || input.readOnly) return;

            // Skip inputs that are already filled — prevents re-triggering confidence popups
            // on second pass (e.g. from MutationObserver after initial fill)
            if (input.value && input.value.trim() !== '') return;

            // Skip Select2-hidden selects — they are enhanced custom dropdowns whose visual
            // layer is controlled by Select2/jQuery. Setting their value directly won't update
            // the UI. Platform-specific strategies (e.g. GreenhouseStrategy) handle these.
            if (
                input.tagName === 'SELECT' &&
                (input.classList.contains('select2-hidden-accessible') ||
                    input.getAttribute('aria-hidden') === 'true' && input.style.display === 'none')
            ) return;

            // Handle Radio/Checkbox
            if (input.type === 'radio' || input.type === 'checkbox') {
                this.handleRadioCheckbox(input, normalizedData);
                return;
            }

            let match = this.findValueForInput(input, normalizedData);

            // --- Multi-Entry Grouping Logic (Education & Employment) ---
            if (match && match.fieldKey) {
                const isEdu = match.fieldKey.startsWith('education_flat');
                const isEmp = match.fieldKey.startsWith('employment.');

                if (isEdu || isEmp) {
                    const sourceData = isEdu ? normalizedData.education : (normalizedData.employment?.history || []);

                    if (sourceData && sourceData.length > 0) {
                        const features = this.extractFeatures(input);
                        const context = (features.label_text + " " + features.nearby_text + " " + (input.name || "")).toLowerCase();
                        let bestIdx = -1;

                        // 1. Context Match
                        let highestScore = 0;
                        sourceData.forEach((item, index) => {
                            let score = 0;
                            const normVal = isEdu ? (item.normDegree + " " + item.normMajor) : (item.normCompany + " " + item.normTitle);
                            if (normVal && context.includes(normVal.toLowerCase())) score += 50;
                            if (item.startDate && context.includes(item.startDate.split('-')[0])) score += 20;

                            if (score > highestScore) {
                                highestScore = score;
                                bestIdx = index;
                            }
                        });

                        // 2. Name-based Index (e.g., degree_0, company_1)
                        if (bestIdx === -1) {
                            const indexMatch = (input.name || "").match(/\d+/);
                            if (indexMatch) {
                                const foundIdx = parseInt(indexMatch[0]);
                                if (foundIdx < sourceData.length) bestIdx = foundIdx;
                            }
                        }

                        // 3. Proximity Fallback
                        if (bestIdx === -1) {
                            const tracker = isEdu ? educationGroupTracker : employmentGroupTracker;
                            const selector = isEdu ? '.education-entry, fieldset' : '.work-entry, .experience-entry, fieldset';
                            const container = input.closest(`${selector}, div[id*="edu"], div[id*="work"]`);

                            const containers = Array.from(document.querySelectorAll(selector));
                            let groupId = container ? containers.indexOf(container) : "global";
                            if (groupId === -1) groupId = "misc-" + (isEdu ? "edu" : "emp");

                            if (!tracker.has(groupId)) {
                                tracker.set(groupId, tracker.size % sourceData.length);
                            }
                            bestIdx = tracker.get(groupId);
                        }

                        if (bestIdx !== -1) {
                            const subKey = match.fieldKey.split('.')[1];
                            if (isEdu) {
                                const eduKeyMap = {
                                    'major': 'area',
                                    'start_date': 'startDate',
                                    'end_date': 'endDate'
                                };
                                const targetKey = eduKeyMap[subKey] || subKey;
                                match.value = sourceData[bestIdx][targetKey] || sourceData[bestIdx][subKey] || sourceData[bestIdx].degree || "";
                            } else {
                                const empKeyMap = {
                                    'current_role': 'position',
                                    'current_company': 'name',
                                    'work_description': 'summary',
                                    'start_date': 'startDate',
                                    'end_date': 'endDate'
                                };
                                const targetKey = empKeyMap[subKey] || subKey;
                                match.value = sourceData[bestIdx][targetKey] || "";
                            }
                            match.confidence = 95;
                        }
                    }
                }
            }



            let status = 'unmatched';
            let finalValue = '';

            if (match && match.value) {
                // Silent skip: if confidence is too low, don't fill AND don't show a popup
                const SILENT_SKIP_THRESHOLD = 40;
                if (match.confidence < SILENT_SKIP_THRESHOLD) {
                    // Too low to be useful — ignore silently
                } else if (match.confidence >= this.CONFIDENCE_THRESHOLD) {
                    this.setInputValue(input, match.value, 'green');
                    status = 'filled';
                    finalValue = match.value;
                } else {
                    this.promptUserConfirmation(input, match.value, match.confidence);
                    status = 'low_confidence';
                    finalValue = match.value; // It is suggested, though not explicitly set yet
                }
            } else {
                // Check if it's a required field that was missed
                if (input.required || input.getAttribute('aria-required') === 'true') {
                    this.highlightUnmatchedRequired(input);
                    status = 'unmatched_required';
                }
            }

            // Only add to report if it's an actionable or matched field
            if (status !== 'unmatched') {
                const labelText = this.getLabelText(input) || input.name || input.id || input.placeholder || "Unknown Field";
                fillReport.push({
                    id: input.id || input.name || Math.random().toString(36).substr(2, 9),
                    label: labelText,
                    value: finalValue,
                    confidence: match ? match.confidence : 0,
                    status: status
                });
            }
        });


        // Send the fill report to the sidepanel
        chrome.runtime.sendMessage({
            action: 'fill_report',
            report: fillReport
        });

        console.log('AutoFill attempt complete.');
    }

    findCustomAnswer(input, hostname, customAtsAnswers) {
        if (!customAtsAnswers) return null;

        const features = this.extractFeatures(input);
        const combinedText = `${features.name_attr} ${features.id_attr} ${features.label_text} ${features.aria_label}`.toLowerCase();

        // Determine which ATS key we are currently under
        let atsKey = "Global";
        if (hostname.includes("greenhouse.io")) atsKey = "Greenhouse";
        else if (hostname.includes("lever.co")) atsKey = "Lever";
        else if (hostname.includes("workday.com") || hostname.includes("myworkdayjobs.com")) atsKey = "Workday";

        // Check platform specific answers first, then fallback to Global
        const answerSets = [customAtsAnswers[atsKey], customAtsAnswers["Global"]];

        for (const answers of answerSets) {
            if (answers && typeof answers === 'object') {
                // Iterate through keys defined by user
                for (const [questionKeyword, customValue] of Object.entries(answers)) {
                    if (combinedText.includes(questionKeyword.toLowerCase())) {
                        return { value: customValue, confidence: 100 };
                    }
                }
            }
        }
        return null;
    }

    extractFeatures(input) {
        return {
            name_attr: (input.name || "").toLowerCase(),
            id_attr: (input.id || "").toLowerCase(),
            placeholder: (input.placeholder || "").toLowerCase(),
            aria_label: (input.getAttribute('aria-label') || "").toLowerCase(),
            label_text: (this.getLabelText(input) || "").toLowerCase(),
            nearby_text: (this.getNearbyText(input) || "").toLowerCase(),
            input_type: (input.type || "text").toLowerCase(),
            normalized_combined: (typeof ResumeProcessor !== 'undefined') ?
                ResumeProcessor.normalizeText(
                    `${input.name || ""} ${input.id || ""} ${this.getLabelText(input)} ${input.getAttribute('aria-label') || ""}`
                ) : ""
        };
    }

    calculateConfidence(features, keywords, fieldKey) {
        let keywordScore = 0;
        const keywordWeights = {
            name_attr: 40,
            id_attr: 40,
            aria_label: 35,
            label_text: 60, // Increased from 35 to favor explicit questions
            placeholder: 25
        };

        let matchedPrimaryFeature = false;

        keywords.forEach(keyword => {
            const kw = keyword.toLowerCase();
            for (const [featureName, weight] of Object.entries(keywordWeights)) {
                const featureValue = features[featureName];
                if (featureValue && featureValue.includes(kw)) {
                    keywordScore += weight;
                    matchedPrimaryFeature = true;
                    if (featureValue === kw) {
                        keywordScore += weight * 0.5;
                    }
                }
            }
        });
        keywordScore = Math.min(keywordScore, 70);

        let contextScore = 0;
        keywords.forEach(keyword => {
            if (features.nearby_text && features.nearby_text.includes(keyword.toLowerCase())) {
                contextScore += 5;
            }
        });
        contextScore = Math.min(contextScore, 15);

        let typeScore = 0;
        const isEmailField = fieldKey === 'email';
        const isPhoneField = fieldKey === 'phone';
        const isUrlField = fieldKey.includes('url') || fieldKey.includes('linkedin') || fieldKey.includes('github') || fieldKey === 'website';

        if (isEmailField && features.input_type === 'email') typeScore = 15;
        else if (isPhoneField && features.input_type === 'tel') typeScore = 15;
        else if (isUrlField && features.input_type === 'url') typeScore = 15;
        else typeScore = 5;

        let confidence = keywordScore + contextScore + typeScore;

        if (!matchedPrimaryFeature) {
            confidence = Math.min(confidence, 30);
        }

        return Math.min(Math.round(confidence), 100);
    }

    findValueForInput(input, normalizedData) {
        const features = this.extractFeatures(input);

        // --- 1. Attempt Domain-Specific Dynamic Reverse Lookups ---
        // Guard: skip this if the label matches a professional statement question.
        // (The label may contain "experiences" which would falsely trigger the years lookup.)
        const PROFESSIONAL_STATEMENT_PHRASES = [
            "describe your relevant experiences",
            "industrial projects",
            "research record",
            "3-4 sentences",
            "highlight your",
            "professional statement"
        ];
        const isProfessionalStatementField = PROFESSIONAL_STATEMENT_PHRASES.some(phrase =>
            features.label_text.includes(phrase) ||
            features.nearby_text.includes(phrase) ||
            features.aria_label.includes(phrase)
        );

        const MOTIVATION_PHRASES = [
            "multiple roles",
            "motivation for each",
            "order them",
            "apply to multiple roles",
            "explain your motivation"
        ];
        const isMotivationField = MOTIVATION_PHRASES.some(phrase =>
            features.label_text.includes(phrase) ||
            features.nearby_text.includes(phrase) ||
            features.aria_label.includes(phrase)
        );

        if (!isProfessionalStatementField && (features.normalized_combined.includes("year") || features.normalized_combined.includes("experience"))) {
            if (normalizedData.reverse_maps) {
                // Check skills first
                for (const [skill, years] of Object.entries(normalizedData.reverse_maps.skill_to_years)) {
                    if (features.normalized_combined.includes(skill)) {
                        return { value: years.toString(), confidence: 95 };
                    }
                }
                // Check titles/companies
                for (const [company, months] of Object.entries(normalizedData.reverse_maps.company_to_duration)) {
                    if (features.normalized_combined.includes(company)) {
                        return { value: Math.round(months / 12).toString(), confidence: 90 };
                    }
                }
                for (const [title, months] of Object.entries(normalizedData.reverse_maps.title_to_duration)) {
                    if (features.normalized_combined.includes(title)) {
                        return { value: Math.round(months / 12).toString(), confidence: 90 };
                    }
                }
            }
        }

        // Fast-path: if this is clearly a professional statement field, return it directly
        if (isProfessionalStatementField && normalizedData.summary?.professional_statement) {
            return {
                value: normalizedData.summary.professional_statement,
                confidence: 100,
                fieldKey: 'summary.professional_statement'
            };
        }

        // Fast-path: if this is clearly a motivation/multiple-roles field, return it directly
        if (isMotivationField && normalizedData.summary?.motivation) {
            return {
                value: normalizedData.summary.motivation,
                confidence: 100,
                fieldKey: 'summary.motivation'
            };
        }

        // --- 2. Standard Heuristic Matching ---
        let bestMatch = { value: null, confidence: 0 };

        for (const [fieldKey, keywords] of Object.entries(this.FIELD_MAPPING)) {
            const confidence = this.calculateConfidence(features, keywords, fieldKey);

            if (confidence > bestMatch.confidence) {
                const value = this.getNestedValue(normalizedData, fieldKey);

                if (value) {
                    bestMatch = { value, confidence, fieldKey };
                }
            }
        }

        return bestMatch.confidence > 0 ? bestMatch : null;
    }

    /**
     * Handle Radio and Checkbox inputs
     */
    handleRadioCheckbox(input, normalizedData) {
        const match = this.findValueForInput(input, normalizedData);
        if (!match || !match.value) return;

        const val = String(match.value).toLowerCase();
        const labelText = (this.getLabelText(input) || "").toLowerCase();

        if (input.type === 'radio') {
            // If the label matches the value, or common synonyms
            const isPositiveMatch =
                labelText.includes(val) ||
                (val === 'yes' && (labelText === 'yes' || labelText === 'y')) ||
                (val === 'no' && (labelText === 'no' || labelText === 'n')) ||
                (val.includes('not a protected veteran') && labelText.includes('not a protected veteran')) ||
                (val.includes('no, i do not have a disability') && labelText.includes('no, i do not have a disability'));

            if (isPositiveMatch) {
                input.checked = true;
                this.setInputValue(input, null, 'green'); // Visual feedback
            }
        } else if (input.type === 'checkbox') {
            if (val === 'yes' || val === 'true' || val === '1') {
                input.checked = true;
                this.setInputValue(input, null, 'green');
            }
        }
    }

    getLabelText(input) {
        if (!input) return '';
        if (input.parentElement && input.parentElement.tagName === 'LABEL') {
            return input.parentElement.innerText;
        }
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.innerText;
        }
        const labeledBy = input.getAttribute('aria-labelledby');
        if (labeledBy) {
            const labelElement = document.getElementById(labeledBy);
            if (labelElement) return labelElement.innerText;
        }
        return '';
    }

    getNearbyText(input) {
        if (!input) return '';
        let container = input.parentElement;
        let iterations = 0;
        while (container && iterations < 2) {
            const text = container.innerText || "";
            if (text.length > 0 && text.length < 200) {
                return text;
            }
            container = container.parentElement;
            iterations++;
        }
        return '';
    }

    setInputValue(input, value, highlightType = 'green') {
        if (!input || (!value && highlightType !== 'red')) return;

        if (value) {
            if (input.tagName === 'SELECT') {
                this.setSelectValue(input, value);
            } else {
                // Use the native setter to bypass React's value interception,
                // then dispatch a synthetic input event so React's onChange fires.
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value'
                )?.set;
                const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, 'value'
                )?.set;

                if (input.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                    nativeTextAreaValueSetter.call(input, value);
                } else if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(input, value);
                } else {
                    input.value = value;
                }
            }

            // Dispatch events to satisfy React (needs bubbles:true + composed:true for shadow DOM)
            ['input', 'change', 'blur'].forEach(eventType => {
                const event = new Event(eventType, { bubbles: true, composed: true });
                input.dispatchEvent(event);
            });

            // Also try the React _valueTracker approach as a belt-and-suspenders
            const tracker = input._valueTracker;
            if (tracker) {
                tracker.setValue(''); // Trick React into thinking value changed
            }
            // Re-dispatch input after tracker reset
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }

        const originalBg = input.style.backgroundColor;
        const originalBorder = input.style.border;

        if (highlightType === 'green') {
            input.style.backgroundColor = "#dcfce7"; // green-100
            input.style.border = "2px solid #22c55e"; // green-500
        } else if (highlightType === 'red') {
            input.style.backgroundColor = "#fee2e2"; // red-100
            input.style.border = "2px solid #ef4444"; // red-500
        }

        // Revert green highlighting after 3 seconds
        if (highlightType === 'green') {
            setTimeout(() => {
                input.style.backgroundColor = originalBg;
                input.style.border = originalBorder;
            }, 3000);
        }
    }

    /**
     * Set value for a SELECT element using fuzzy matching on options
     */
    setSelectValue(select, value) {
        if (!select || !value) return;

        const normalize = (s) => String(s).toLowerCase().replace(/[^\w\s]/g, '').trim();
        const val = normalize(value);

        let bestOptionIndex = -1;
        let highestConfidence = 0;

        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            const optText = normalize(option.text);
            const optVal = normalize(option.value);

            // 1. Perfect match (100)
            if (optVal === val || optText === val) {
                bestOptionIndex = i;
                highestConfidence = 100;
                break;
            }

            // 2. Starts with (90)
            if (optText.startsWith(val) || val.startsWith(optText)) {
                if (90 > highestConfidence) {
                    bestOptionIndex = i;
                    highestConfidence = 90;
                }
            }
            // 3. Includes (70)
            else if (optText.includes(val) || val.includes(optText)) {
                if (70 > highestConfidence) {
                    bestOptionIndex = i;
                    highestConfidence = 70;
                }
            }
        }

        if (bestOptionIndex !== -1) {
            select.selectedIndex = bestOptionIndex;
        } else {
            // Fallback: try setting value directly
            select.value = value;
        }
    }

    highlightUnmatchedRequired(input) {
        this.setInputValue(input, null, 'red');
    }

    promptUserConfirmation(input, suggestion, confidence) {
        const originalBorder = input.style.border;
        const originalBackground = input.style.backgroundColor;

        input.style.border = "2px solid #f59e0b";
        input.style.backgroundColor = "#fffbeb";

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.zIndex = '999999';
        container.style.backgroundColor = '#ffffff';
        container.style.border = '1px solid #d1d5db';
        container.style.borderRadius = '4px';
        container.style.padding = '8px';
        container.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '4px';
        container.style.fontSize = '12px';
        container.style.fontFamily = 'system-ui, sans-serif';
        container.style.color = '#374151';

        const info = document.createElement('div');
        info.innerHTML = `<strong>Suggested:</strong> ${suggestion}<br/><span style="color: #6b7280; font-size: 10px;">Confidence: ${confidence}%</span>`;

        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.gap = '4px';
        buttonRow.style.marginTop = '4px';

        const acceptBtn = document.createElement('button');
        acceptBtn.innerHTML = '✓ Accept';
        acceptBtn.style.padding = '2px 8px';
        acceptBtn.style.backgroundColor = '#10b981';
        acceptBtn.style.color = 'white';
        acceptBtn.style.border = 'none';
        acceptBtn.style.borderRadius = '2px';
        acceptBtn.style.cursor = 'pointer';

        const rejectBtn = document.createElement('button');
        rejectBtn.innerHTML = '✗ Reject';
        rejectBtn.style.padding = '2px 8px';
        rejectBtn.style.backgroundColor = '#ef4444';
        rejectBtn.style.color = 'white';
        rejectBtn.style.border = 'none';
        rejectBtn.style.borderRadius = '2px';
        rejectBtn.style.cursor = 'pointer';

        buttonRow.appendChild(acceptBtn);
        buttonRow.appendChild(rejectBtn);
        container.appendChild(info);
        container.appendChild(buttonRow);

        const rect = input.getBoundingClientRect();
        container.style.top = `${window.scrollY + rect.bottom + 4}px`;
        container.style.left = `${window.scrollX + rect.left}px`;

        document.body.appendChild(container);

        const cleanup = () => {
            container.remove();
            input.style.border = originalBorder;
            input.style.backgroundColor = originalBackground;
        };

        acceptBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.setInputValue(input, suggestion);
            cleanup();
        });

        rejectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cleanup();
        });
    }
}

// Global exposure
if (typeof window !== 'undefined') {
    window.GenericStrategy = GenericStrategy;
}

