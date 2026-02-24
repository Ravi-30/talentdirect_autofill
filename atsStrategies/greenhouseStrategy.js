class GreenhouseStrategy extends GenericStrategy {
    constructor() {
        super();
        this.CONFIDENCE_THRESHOLD = 60;
        this.executed = false; // ✅ Prevent multiple popups
    }

    execute(normalizedData, aiEnabled) {
        if (this.executed) {
            console.log("GreenhouseStrategy already executed. Skipping...");
            return;
        }

        if (!normalizedData) {
            console.error("No resume data provided.");
            return;
        }

        this.executed = true; // lock execution

        console.log("Executing GreenhouseStrategy...");

        const inputs = document.querySelectorAll("input, select, textarea");

        inputs.forEach((input) => {
            // Greenhouse often hides native selects; we should fill them even if they look hidden 
            // but NOT if they are truly hidden inputs (type="hidden")
            if (input.type === "hidden" && !input.id && !input.name) return;
            if (input.disabled || input.readOnly) return;

            let match = this.findGreenhouseSpecificMatch(input, normalizedData);

            if (!match || !match.value) {
                match = this.findValueForInput(input, normalizedData);
            }

            if (match && match.value && match.confidence >= this.CONFIDENCE_THRESHOLD) {
                this.fillField(input, match.value);
            } else if (aiEnabled && match?.value) {
                console.log("AI Suggestion:", input.name || input.id);
            }
        });

        console.log("Greenhouse AutoFill complete.");
    }

    /* ===============================
       ✅ FIELD FILLING (FIXED)
    ================================== */

    fillField(input, value) {
        if (!input) return;

        // Use the improved setInputValue from GenericStrategy
        this.setInputValue(input, value);
    }

    /* ===============================
       ✅ GREENHOUSE SPECIFIC MATCHING
    ================================== */

    findGreenhouseSpecificMatch(input, data) {
        const id = (input.id || "").toLowerCase();
        const name = (input.name || "").toLowerCase();
        let labelTxt = "";

        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) labelTxt = label.innerText.toLowerCase();
        }

        if (!labelTxt) {
            const parent = input.closest("div") || input.parentElement;
            labelTxt = parent?.innerText?.toLowerCase() || "";
        }

        const identity = data?.identity || {};
        const contact = data?.contact || {};

        // ✅ Basic fields
        if (id.includes("first_name") || name.includes("first_name"))
            return { value: identity.first_name, confidence: 95 };

        if (id.includes("last_name") || name.includes("last_name"))
            return { value: identity.last_name, confidence: 95 };

        if (id.includes("email") || name.includes("email"))
            return { value: contact.email, confidence: 95 };

        if (id.includes("phone") || name.includes("phone"))
            return { value: contact.phone, confidence: 95 };

        // ✅ LinkedIn
        if (labelTxt.includes("linkedin") || id.includes("linkedin"))
            return { value: contact.linkedin, confidence: 90 };

        // ✅ Portfolio / GitHub
        if (
            labelTxt.includes("github") ||
            labelTxt.includes("portfolio") ||
            labelTxt.includes("website")
        ) {
            const portfolio = contact.portfolio || contact.github;
            return { value: portfolio, confidence: 85 };
        }

        return null;
    }
}

/* ===============================
   ✅ REGISTER STRATEGY
================================== */

if (typeof ATSStrategyRegistry !== "undefined") {
    ATSStrategyRegistry.register(
        (url, doc) => url.includes("greenhouse.io") || !!doc.querySelector('meta[content*="greenhouse"]') || !!doc.querySelector('.grnhse-wrapper'),
        GreenhouseStrategy
    );
}