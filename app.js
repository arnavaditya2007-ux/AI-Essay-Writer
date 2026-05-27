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

// Inject current year into footer
const yearEl = document.getElementById('currentYear');
if (yearEl) yearEl.textContent = new Date().getFullYear();

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
// Shared HTML cleaner — strips markdown code fences from AI responses
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
};

// Post-processor: capitalize the first letter of every sentence in every <p> and <h2>
const capitalizeFirstLetters = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;

    div.querySelectorAll('p, h2').forEach(el => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let isFirstTextNode = true;
        let node;

        while ((node = walker.nextNode())) {
            let text = node.textContent;

            // Capitalize the very first letter of the paragraph/heading
            if (isFirstTextNode && text.length > 0) {
                const idx = text.search(/[a-zA-Z]/);
                if (idx !== -1) {
                    text = text.substring(0, idx) + text.charAt(idx).toUpperCase() + text.substring(idx + 1);
                }
                isFirstTextNode = false;
            }

            // Capitalize first letter after sentence-ending punctuation (. ? !)
            text = text.replace(/([.!?]\s+)([a-z])/g, (m, punct, letter) => punct + letter.toUpperCase());

            node.textContent = text;
        }
    });

    return div.innerHTML;
};

// Post-processor: programmatically inject exactly 3-4 typos per paragraph into long words
const injectTypos = (html) => {
    const commonTypos = {
        "environment": "enviroment", "definitely": "definately", "separate": "seperate", 
        "government": "goverment", "beautiful": "beatiful", "necessary": "neccesary", 
        "successful": "succesful", "beginning": "begining", "independent": "independant",
        "different": "diferent", "unnecessary": "unnecesary", "believe": "beleive",
        "receive": "recieve", "until": "untill", "truly": "truely", "occurrence": "occurance",
        "argument": "arguement", "surprise": "suprise", "therefore": "therefor",
        "weird": "wierd", "accommodate": "acommodate", "recommend": "recomend"
    };

    const makeTypo = (word) => {
        const lower = word.toLowerCase();
        if (commonTypos[lower]) {
            return word[0] === word[0].toUpperCase() ? 
                   commonTypos[lower].charAt(0).toUpperCase() + commonTypos[lower].slice(1) : 
                   commonTypos[lower];
        }
        if (word.length >= 6) {
            const chars = word.split('');
            const swapIdx = Math.floor(Math.random() * (chars.length - 3)) + 1;
            const temp = chars[swapIdx];
            chars[swapIdx] = chars[swapIdx + 1];
            chars[swapIdx + 1] = temp;
            return chars.join('');
        }
        return word;
    };

    const div = document.createElement('div');
    div.innerHTML = html;

    div.querySelectorAll('p').forEach(p => {
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
        let textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        let eligibleWords = [];
        textNodes.forEach(tNode => {
            const text = tNode.textContent;
            const regex = /\b[A-Za-z]{6,}\b/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                eligibleWords.push({
                    node: tNode,
                    word: match[0],
                    startIdx: match.index,
                    endIdx: match.index + match[0].length
                });
            }
        });

        const numTypos = Math.floor(Math.random() * 2) + 3; // 3 or 4
        
        for (let i = eligibleWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [eligibleWords[i], eligibleWords[j]] = [eligibleWords[j], eligibleWords[i]];
        }

        const selected = eligibleWords.slice(0, numTypos);
        const nodeReplacements = new Map();
        
        selected.forEach(sel => {
            if (!nodeReplacements.has(sel.node)) {
                nodeReplacements.set(sel.node, []);
            }
            nodeReplacements.get(sel.node).push(sel);
        });

        nodeReplacements.forEach((replacements, tNode) => {
            replacements.sort((a, b) => b.startIdx - a.startIdx);
            let text = tNode.textContent;
            replacements.forEach(rep => {
                const typoed = makeTypo(rep.word);
                text = text.substring(0, rep.startIdx) + typoed + text.substring(rep.endIdx);
            });
            tNode.textContent = text;
        });
    });

    return div.innerHTML;
};

// Post-processor: programmatically filter out em-dashes and question marks
const filterPunctuation = (html) => {
    let filtered = html;
    // Replace em-dashes and en-dashes with commas or spaces to maintain readability
    filtered = filtered.replace(/—/g, ', ');
    filtered = filtered.replace(/–/g, ', ');
    
    // Replace question marks with periods since questions are banned
    filtered = filtered.replace(/\?/g, '.');
    
    return filtered;
};

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

        const response = await fetchWithTimeout(API_ENDPOINT, {
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

STAGE 2: CRITICAL HUMANIZATION (ANTI-AI DETECTION)
You must completely rewrite the essay to bypass AI detectors. AI detectors flag text that has low perplexity (predictable word choices) and low burstiness (uniform sentence length). To bypass them, you must write with HIGH perplexity and HIGH burstiness.

0. User Configuration Rules (MUST FOLLOW):
   - Topic: Stay strictly on the topic: "${topicInput.value.trim()}".
   - Writing Tone: Adhere strictly to the "${toneSelect.value}" tone.
   - Writing Level: Write exactly at the "${levelSelect.value}" level.
   - Outline Constraints: ${subheadingsInput.value.trim() ? `You must maintain the flow of this outline: "${subheadingsInput.value.trim()}".` : 'Maintain the original outline flow.'}

1. EXTREME BURSTINESS (Crucial): 
   - Your sentence lengths must be completely chaotic. You must include extremely short, punchy sentences (2-5 words). You must also include long, meandering sentences (30+ words). 
   - Never write three sentences of the same length in a row. Force variation.

2. HIGH PERPLEXITY & BANNED WORDS: 
   - Do NOT use predictable, formal "essay" words like "supreme instance", "undying emblem", "monumental endeavor", "testament to", "crucial role", "delve", "tapestry", "unparalleled", "realm", "perished".
   - Do NOT use "fake human" slang like "basically", "super", "really", "stuff".
   - Use everyday vocabulary, but combine words in highly specific, slightly unusual ways. Avoid clichés entirely.

3. ASYMMETRICAL STRUCTURE & BANNED PUNCTUATION:
   - Write as if you are a passionate expert explaining the topic to a peer in person. 
   - Occasionally start sentences with "But", "And", or "Because".
   - Never use standard transition words like "Furthermore", "Moreover", "In conclusion", "Additionally", "Thus".
   - BANNED PUNCTUATION: You MUST NEVER use em-dashes (—) or question marks (?). Write declarative sentences only.

4. STRUCTURE RULES:
   - Paragraph Count Constraint: You MUST output exactly ${paragraphCount} body paragraphs (using <p> tags). Do not merge them.
   - Word Count: Your humanized output MUST be between ${originalWordCount - 15} and ${originalWordCount + 15} words.

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
            html = capitalizeFirstLetters(html);
            html = injectTypos(html);
            html = filterPunctuation(html);

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

