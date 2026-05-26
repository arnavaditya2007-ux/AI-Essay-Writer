// Initialize Lucide Icons (called after elements have initial HTML set)
// Elements
const topicInput = document.getElementById('topic');
const avoidInput = document.getElementById('avoid');
const toneSelect = document.getElementById('tone');
const lengthSelect = document.getElementById('length');
const levelSelect = document.getElementById('level');
const paragraphsSelect = document.getElementById('paragraphs');
const subheadingsInput = document.getElementById('subheadings');
const generateBtn = document.getElementById('generateBtn');
const outputCard = document.getElementById('outputCard');
const essayOutput = document.getElementById('essayOutput');
const copyBtn = document.getElementById('copyBtn');
const themeToggle = document.getElementById('themeToggle');

const API_ENDPOINT = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api/generate'
    : (window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io'))
    ? 'https://ai-essay-writer-blue.vercel.app/api/generate'
    : '/api/generate';

// Fetch helper with visual countdown. Timer resets to 30s if it reaches 0 — no backend abort or retry.
const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000, buttonElement = null, loadingText = "Loading") => {
    let secondsLeft = Math.round(timeoutMs / 1000);
    let timerId = null;

    if (buttonElement) {
        buttonElement.innerHTML = `
            <span>${loadingText} (${secondsLeft}s)</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        timerId = setInterval(() => {
            secondsLeft--;
            // When countdown hits 0 just loop back to 30 — backend keeps running
            if (secondsLeft <= 0) secondsLeft = Math.round(timeoutMs / 1000);
            buttonElement.innerHTML = `
                <span>${loadingText} (${secondsLeft}s)</span>
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
            `;
        }, 1000);
    }

    try {
        const response = await fetch(url, options);
        if (timerId) clearInterval(timerId);
        return response;
    } catch (err) {
        if (timerId) clearInterval(timerId);
        throw err;
    }
};

let isGenerating = false;

// Persist & guard topic against browser autofill clearing it
let topicGuard = localStorage.getItem('essayTopic') || '';
if (topicGuard) topicInput.value = topicGuard;

topicInput.addEventListener('input', () => {
    if (topicInput.value) topicGuard = topicInput.value;
    localStorage.setItem('essayTopic', topicInput.value);
});

// Restore topic immediately if any control change clears it
[toneSelect, lengthSelect, levelSelect, paragraphsSelect, subheadingsInput, avoidInput].forEach(el => {
    el.addEventListener('change', () => {
        if (!topicInput.value && topicGuard) {
            topicInput.value = topicGuard;
        }
    });
});


// Theme Switcher Logic
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.innerHTML = '<i data-lucide="sun"></i>';
} else {
    themeToggle.innerHTML = '<i data-lucide="moon"></i>';
}
lucide.createIcons();

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    let theme = 'dark';
    if (document.body.classList.contains('light-theme')) {
        theme = 'light';
        themeToggle.innerHTML = '<i data-lucide="sun"></i>';
    } else {
        themeToggle.innerHTML = '<i data-lucide="moon"></i>';
    }
    localStorage.setItem('theme', theme);
    lucide.createIcons();
});
// Generate Action
generateBtn.addEventListener('click', async () => {
    if (isGenerating) return;

    const topic = topicInput.value.trim();
    if (!topic) {
        alert('Please enter a topic before generating.');
        return;
    }

    try {
        isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.innerHTML = `
            <span>Writing Essay</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        
        // Show output card with loading message
        outputCard.classList.remove('hidden');
        essayOutput.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Structuring essay and gathering context...</p>';
        outputCard.scrollIntoView({ behavior: 'smooth' });

        const numParagraphs = parseInt(paragraphsSelect.value) || 5;
        let totalWordTarget = 1000;
        const lengthVal = lengthSelect.value;
        if (lengthVal.includes('500')) {
            totalWordTarget = 500;
        } else if (lengthVal.includes('1500')) {
            totalWordTarget = 1500;
        }
        const wordsPerParagraph = Math.round(totalWordTarget / numParagraphs);

        const prompt = `You MUST strictly follow these 6 user configuration rules:
                        1. Topic: Write about the topic: "${topic}".
                        2. Writing Tone: Adhere strictly to the "${toneSelect.value}" tone.
                        3. Writing Level / Audience: Write exactly at the "${levelSelect.value}" level (this controls vocabulary difficulty, argument depth, and assumed knowledge).
                        4. Target Length: Write approximately ${totalWordTarget} words in total.
                        5. Required Paragraphs: Structure the essay into exactly ${numParagraphs} body paragraphs. Each paragraph MUST contain approximately ${wordsPerParagraph} words. Do NOT make paragraphs very short.
                        6. Outline & Subheadings: ${subheadingsInput.value.trim() ? `You must structure the essay according to this outline: "${subheadingsInput.value.trim()}". Transition between these outline sections smoothly.` : 'Write a coherent, structured outline flow.'}
                        
                        ${avoidInput.value.trim() ? `7. Avoid Topics (Optional Rule): Strictly avoid referencing or mentioning: "${avoidInput.value.trim()}".` : ''}

                        Heading/Title Requirement: You MUST start the essay with a single <h2> heading containing a creative, engaging title for the essay. Do NOT use any other <h2> tags or subheadings anywhere else in the essay.
                         
                        Formatting & Completion:
                        1. Structure the essay beautifully so that it has exactly ${numParagraphs} body paragraphs.
                        2. Each paragraph MUST be robust and detailed, containing approximately ${wordsPerParagraph} words. The total word count of the entire essay MUST be approximately ${totalWordTarget} words. Do NOT generate very short paragraphs of only 30-50 words.
                        3. Output the response formatted directly as HTML using <p> tags for all paragraphs and a single <h2> tag at the very beginning for the title.
                        4. Do not include any markdown code block fences (like \`\`\`html) or metadata notes. Start directly with the <h2> tag.
                        5. Ensure that the essay is fully completed. Do NOT cut off mid-sentence or mid-paragraph. All sentences must be fully completed and end with proper punctuation.
                        6. Absolutely NO bold text is allowed (do not use <strong>, <b>, or markdown **). Everything inside paragraphs must be standard weight.
                        7. Absolutely NO long dashes or em-dashes (— or --) are allowed in the essay text. Use commas or split into separate sentences instead.`;

        const cleanHtml = (text) => {
            let cleaned = text.trim();
            cleaned = cleaned.replace(/^```html\s*([\s\S]*?)\s*```$/g, '$1')
                             .replace(/^```\s*([\s\S]*?)\s*```$/g, '$1');
            if (cleaned.startsWith('```html')) {
                cleaned = cleaned.replace(/^```html\s*/, '');
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```\s*/, '');
            }
            if (cleaned.endsWith('```')) {
                cleaned = cleaned.replace(/\s*```$/, '');
            }
            return cleaned.trim();
        };        const response = await fetchWithTimeout(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: `You are an AI essay writer. Write a complete, well-structured essay based on the topic and options.
CRITICAL: You MUST write the entire essay including the title (in a single <h2> tag) and all body paragraphs (in separate <p> tags). Never stop after writing only the title.
Output the response formatted directly as HTML. Do NOT include any markdown code block fences (like \`\`\`html) or metadata notes. Start directly with the <h2> tag.
Absolutely NO bold text is allowed. Everything must be standard weight.
Absolutely NO long dashes or em-dashes (— or --) are allowed. Use commas or split into separate sentences.`
                    },
                    { role: 'user', content: prompt }
                ]
            })
        }, 30000, generateBtn, "Writing Essay");

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || `API error (HTTP ${response.status})`;
            essayOutput.innerHTML = `<p style="color: #ef4444;">API Error: ${errMsg}</p>`;
            console.error('API Error:', data);
            return;
        }

        if (data.choices && data.choices[0]?.message?.content) {
            let html = cleanHtml(data.choices[0].message.content);

            // Auto-retry once if no <p> tags are present (title-only or empty body generation)
            if (!html.includes('<p>')) {
                console.warn("Only title or empty body generated. Attempting auto-retry...");
                essayOutput.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Title generated. Adding body paragraphs (retrying)...</p>';
                try {
                    const retryResponse = await fetchWithTimeout(API_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            max_tokens: 8192,
                            messages: [
                                {
                                    role: 'system',
                                    content: `You are an AI essay writer. Write a complete, well-structured essay based on the topic and options.
CRITICAL: The previous attempt failed because you did not write the body paragraphs. You MUST output the title AND all requested body paragraphs. Do not output only the title. Format directly as HTML.`
                                },
                                { role: 'user', content: prompt + "\n\nCRITICAL: You MUST write the full essay body paragraphs. Do not stop after writing the title. Output the title (<h2>) and all paragraphs (<p>)." }
                            ]
                        })
                    }, 30000, generateBtn, "Writing Essay");
                    const retryData = await retryResponse.json();
                    if (retryResponse.ok && retryData.choices && retryData.choices[0]?.message?.content) {
                        html = cleanHtml(retryData.choices[0].message.content);
                    }
                } catch (retryErr) {
                    console.error('Retry failed:', retryErr);
                }
            }

            essayOutput.innerHTML = html;
            
            // Reset Humanize Button for the new essay
            humanizeBtn.disabled = false;
            humanizeBtn.innerHTML = `
                <i data-lucide="wand-2"></i>
                <span>Humanize</span>
            `;
            lucide.createIcons();
        } else {
            const msg = 'No content was returned. Please try again with a different topic.';
            essayOutput.innerHTML = `<p style="color: #ef4444;">${msg}</p>`;
            console.error('Unexpected response:', data);
        }
    } catch (err) {
        essayOutput.innerHTML = '<p style="color: #ef4444;">A network error occurred. Please check your connection and try again.</p>';
        console.error('Network error:', err);
    } finally {
        isGenerating = false;
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
            <span>Generate Essay</span>
            <i data-lucide="sparkles"></i>
        `;
        lucide.createIcons();
    }
});

humanizeBtn.addEventListener('click', async () => {
    if (isGenerating) return;
    
    const currentEssay = essayOutput.innerHTML.trim();
    if (!currentEssay || currentEssay.includes('Structuring essay') || currentEssay.includes('API Error')) {
        essayOutput.innerHTML = '<p style="color: #ef4444;">Please generate an essay first before humanizing.</p>';
        return;
    }

    // Parse original paragraph count and word count
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentEssay;
    const paragraphCount = tempDiv.querySelectorAll('p').length || 5;

    // Extract plain text per paragraph — reduces payload size vs sending raw HTML
    const paragraphTexts = Array.from(tempDiv.querySelectorAll('p')).map(p => p.innerText.trim());
    const titleText = (tempDiv.querySelector('h2')?.innerText || '').trim();
    const plainEssay = (titleText ? `Title: ${titleText}\n\n` : '') + paragraphTexts.join('\n\n');

    const originalWordCount = plainEssay.trim().split(/\s+/).filter(Boolean).length || 500;

    try {
        isGenerating = true;
        humanizeBtn.disabled = true;
        humanizeBtn.innerHTML = `
            <span>Humanizing</span>
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        
        // Show in-progress message in output
        essayOutput.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Humanizing text to bypass AI detectors...</p>';

        const response = await fetchWithTimeout(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: `Before you write, perform a critical humanization rewrite to guarantee the final text completely bypasses all AI detectors (like ZeroGPT, Turnitin, GPTZero) by making it look like it was written by an average student typing quickly:

STAGE 2: CRITICAL HUMANIZATION (THE CRUCIAL STEP)
Thoroughly review and rewrite the provided essay to completely strip out all AI-generated markers. You must actively apply these strict, rule-based student-style humanizing modifications:

1. Banned AI Casual Fillers (STRICTLY PROHIBITED):
   - You must NEVER use the following words or phrases. They are common AI signatures when trying to sound casual:
     * basically, honestly, literally, actually, essentially, simply, really, super, very
     * thing, stuff (e.g., do not write "mausoleum thing" or "architecture stuff")
     * "and yeah", "so yeah", "but anyways"
     * "testament to", "not only... but also", "plays a crucial role", "delve", "tapestry", "unparalleled", "culmination", "stands proudly"

2. Syntactic Constraints:
   - Sentence Length Cap: No sentence may exceed 15 words. Break up long clauses into short, abrupt sentences.
   - No Apostrophes in Contractions: All contractions MUST be written without apostrophes (e.g., write "dont", "cant", "its", "im", "ive", "didnt", "wasnt", "arent"). Real students typing quickly omit these, and it is a major perplexity signal.
   - Lowercase "i": The standalone pronoun "i" MUST always be lowercase "i".
   - Capitalization Rules: The first letter of every single sentence and the first letter of every single paragraph MUST always be capitalized. Never start a sentence or a paragraph with a lowercase letter (for example, never start a sentence or paragraph with a lowercase 't' like 'the 17th century...', it MUST be capitalized as 'The 17th century...').
   - Inconsistent Capitalization: Occasionally write proper nouns in lowercase (e.g., write "india", "agra", "taj mahal", "shah jahan" in lowercase). However, if a proper noun is the very first word of a sentence, it MUST start with a capital letter.

3. Typo Density & Errors:
   - You MUST inject exactly 2 to 3 spelling typos per paragraph.
   - These typos MUST only be in LONG, complex words (never in short/basic words).
   - Examples of allowed long-word typos to choose from: "definately" (definitely), "seperate" (separate), "goverment" (government), "enviroment" (environment), "beatiful" (beautiful), "neccesary" (necessary), "diferent" (different), "succesful" (successful), "begining" (beginning), "unnecesary" (unnecessary), "independant" (independent).
   - Never misspell short words (do NOT write "becuase" or "untill"). Keep all short words spelled correctly.
   - Use comma splices (joining two complete thoughts with just a comma, e.g., "they finished it in 1653, it took a long time").

4. Structure & Punctuation Constraints:
   - Paragraph Count Constraint: You MUST output exactly ${paragraphCount} body paragraphs (using <p> tags). Do not merge them into one or change the paragraph count under any circumstances. Keep the paragraph breaks exactly where they were in the original.
   - Word Count & Detail Preservation: The humanized essay MUST preserve the length, detail, and arguments of the original essay. Do not summarize, shorten, or simplify it. The total word count of your humanized output MUST be between ${originalWordCount - 15} and ${originalWordCount + 15} words (the input has exactly ${originalWordCount} words).
   - Use 1-2 parenthetical remarks to show a student's side thoughts (e.g., "(i think it was in 1631 or something)" or "(our history teacher talked about this)").
   - Never use triads or lists of three items (avoid "A, B, and C").
   - Absolutely NO bold formatting is allowed (do NOT use <strong>, <b>, or markdown **). Everything must be standard text weight.
   - Absolutely NO em-dashes (—) or double hyphens (--) are allowed. Use commas or split sentences.

OUTPUT REQUIREMENT:
Only output the final, fully humanized essay formatted directly as HTML (<h2> for the title, <p> for the paragraphs). Do not output any markdown code blocks, labels, or explanations. Start directly with the <h2> tag.`
                    },
                    {
                        role: 'user',
                        content: `Please rewrite the following essay to fully humanize it according to the system instructions. Do not change the general topic or arguments, but completely rephrase the sentences and vocabulary to ensure it sounds like a human and bypasses all AI detectors.

Paragraph count constraint: You MUST output exactly ${paragraphCount} body paragraphs (using <p> tags). Maintain the original paragraph structure and transitions, just rephrase the contents. Do not merge them.

Word count constraint: Your humanized output MUST contain between ${originalWordCount - 15} and ${originalWordCount + 15} words (the input has exactly ${originalWordCount} words). Do not summarize or shorten any section.

Essay:
${plainEssay}`
                    }
                ]
            })
        }, 30000, humanizeBtn, "Humanizing");

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || `API error (HTTP ${response.status})`;
            essayOutput.innerHTML = currentEssay; // Restore original essay
            essayOutput.insertAdjacentHTML('afterbegin', `<p style="color:#ef4444;margin-bottom:1rem;">Humanizer Error: ${errMsg}</p>`);
            return;
        }

        if (data.choices && data.choices[0]?.message?.content) {
            let html = cleanHtml(data.choices[0].message.content);

            essayOutput.innerHTML = html;
            
            // Change button state to Completed
            humanizeBtn.disabled = true;
            humanizeBtn.innerHTML = `
                <i data-lucide="check"></i>
                <span>Humanized!</span>
            `;
            lucide.createIcons();
        } else {
            essayOutput.innerHTML = currentEssay; // Restore original
            essayOutput.insertAdjacentHTML('afterbegin', '<p style="color:#ef4444;margin-bottom:1rem;">No humanized content was returned. Please try again.</p>');
        }
    } catch (err) {
        essayOutput.innerHTML = currentEssay; // Restore original
        essayOutput.insertAdjacentHTML('afterbegin', '<p style="color:#ef4444;margin-bottom:1rem;">Network error during humanization. Please try again.</p>');
        console.error('Humanizer Network error:', err);
    } finally {
        isGenerating = false;
        // Only restore the button if we didn't successfully complete (success sets it to "Humanized!")
        if (!humanizeBtn.innerHTML.includes('Humanized')) {
            humanizeBtn.disabled = false;
            humanizeBtn.innerHTML = `
                <i data-lucide="wand-2"></i>
                <span>Humanize</span>
            `;
            lucide.createIcons();
        }
    }
});

// Copy to Clipboard
copyBtn.addEventListener('click', () => {
    const text = essayOutput.innerText;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i data-lucide="check"></i><span>Copied!</span>';
        lucide.createIcons();
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            lucide.createIcons();
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
});

