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
            "summary.professional_statement": ["describe your relevant experiences", "professional statement", "highlight your industrial projects", "research record"],
            "employment.current_role": ["title", "position", "role", "job_title", "current role", "current title"],
            "employment.current_company": ["company", "employer", "current company", "organization"],
            "employment.years_total": ["total experience", "years experience", "total years"],
            // Dropdown specific / Additional fields
            "education_flat.degree": ["degree", "level of education", "educational attainment"],
            "education_flat.institution": ["school", "university", "college", "institution"],
            "education_flat.major": ["major", "field of study", "specialization", "discipline"],
            "education_flat.start_date": ["start date", "graduation date", "edu start"],
            "education_flat.end_date": ["end date", "graduation date", "edu end"],
            "identity.gender": ["gender", "sex"],
            "identity.ethnicity": ["ethnicity", "race", "hispanic"],
            "identity.hispanic_latino": ["hispanic", "latino"],
            "identity.veteran_status": ["veteran", "military"],
            "identity.disability_status": ["disability", "handicap"],
            "identity.sponsorship_required": ["sponsorship", "visa", "work authorization", "authorized to work"],
            "availability.start_date": ["start date", "availability", "soonest start", "available to start"]
        };
    }

    getNestedValue(obj, path) {
        if (!obj || !path) return null;
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    execute(normalizedData, aiEnabled) {
        console.log("Executing GenericStrategy...");
        const inputs = document.querySelectorAll('input, textarea, select');

        // This array will hold the report data for the side panel
        let fillReport = [];

        inputs.forEach(input => {
            // Allow hidden fields if they have a name or id (likely state holders for custom dropdowns)
            if (input.type === 'hidden' && !input.id && !input.name && !input.getAttribute('data-automation-id')) return;
            if (input.disabled || input.readOnly) return;

            // Skip radio/checkbox if they require specific handling in sub-strategies
            if (input.type === 'radio' || input.type === 'checkbox') return;

            const match = this.findValueForInput(input, normalizedData);

            let status = 'unmatched';
            let finalValue = '';

            if (match && match.value) {
                if (match.confidence >= this.CONFIDENCE_THRESHOLD) {
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
            label_text: 35,
            placeholder: 20
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
        if (features.normalized_combined.includes("year") || features.normalized_combined.includes("experience")) {
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

        // --- 2. Standard Heuristic Matching ---
        let bestMatch = { value: null, confidence: 0 };

        for (const [fieldKey, keywords] of Object.entries(this.FIELD_MAPPING)) {
            const confidence = this.calculateConfidence(features, keywords, fieldKey);

            if (confidence > bestMatch.confidence) {
                const value = this.getNestedValue(normalizedData, fieldKey);

                if (value) {
                    bestMatch = { value, confidence };
                }
            }
        }

        return bestMatch.confidence > 0 ? bestMatch : null;
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
                input.value = value;
            }

            // Dispatch a flurry of events to satisfy different frameworks (React, Vue, etc.)
            ['input', 'change', 'blur', 'focus', 'click'].forEach(eventType => {
                const event = new Event(eventType, { bubbles: true });
                input.dispatchEvent(event);
            });

            // Bonus: trigger React's internal onChange if possible
            const tracker = input._valueTracker;
            if (tracker) {
                tracker.setValue(value);
            }
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
