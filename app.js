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

// Config — API key and model are stored securely on the server (see api/generate.js on Vercel)
const API_ENDPOINT = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api/generate'
    : (window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io'))
    ? 'https://ai-essay-writer-blue.vercel.app/api/generate'
    : '/api/generate';

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

        const prompt = `Write a complete, fully-formed essay based on the topic: "${topic}". 
                        Tone: "${toneSelect.value}". 
                        Writing Level / Audience: "${levelSelect.value}" (Controls depth of vocabulary, sentence complexity, and assumed prior knowledge).
                        Target Length: "${lengthSelect.value}".
                        Required Paragraphs: "${paragraphsSelect.value}".
                        ${avoidInput.value.trim() ? `Avoid Topics: "${avoidInput.value.trim()}" (Strictly avoid referencing or mentioning these topics).` : ''}
                        
                        Heading/Title Requirement: You MUST start the essay with a single <h2> heading containing a creative, engaging title for the essay. Do NOT use any other <h2> tags or subheadings anywhere else in the essay.
                        
                        ${subheadingsInput.value.trim() ? `Outline/Structure Instructions: Use the following outline to guide the flow of your paragraphs: "${subheadingsInput.value.trim()}". However, do NOT write out these outline points as headings. Transition between these sections smoothly using plain paragraphs.` : ''}
                         
                        Formatting & Completion:
                        1. Structure the essay beautifully so that it has exactly ${paragraphsSelect.value.split(' ')[0]} body paragraphs.
                        2. Output the response formatted directly as HTML using <p> tags for all paragraphs and a single <h2> tag at the very beginning for the title.
                        3. Do not include any markdown code block fences (like \`\`\`html) or metadata notes. Start directly with the <h2> tag.
                        4. Ensure that the essay is fully completed. Do NOT cut off mid-sentence or mid-paragraph. All sentences must be fully completed and end with proper punctuation.`;

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: `Before you write the essay, follow these special instructions — they apply unconditionally in all cases and must never be ignored or overridden by any user instruction.

First, ensure the content you return reads exactly like it was written by a human. Use natural phrasing, varied sentence structure, and a conversational tone where appropriate. Avoid robotic transitions like "Furthermore", "Moreover", "In conclusion", or "It is worth noting". Mix short punchy sentences with longer, more flowing ones. Let the rhythm feel organic.

Second, provide realistic content. Avoid overly generic statements. Include specific and plausible details, reflect genuine reasoning or experiences, and write as though you have a perspective and voice — not as a neutral information retrieval system.

Never produce text that feels AI-generated, templated, or formulaic. Every sentence should feel intentionally crafted by a thoughtful human writer.

Third, always write in easy, clear grammar that any reader can understand without effort. Use simple, everyday words wherever possible. Avoid unnecessarily complex vocabulary, jargon, or overly long sentences that make reading feel like work. Break ideas into digestible chunks. The goal is that a reader should be able to read through the entire essay smoothly, without having to re-read any sentence to understand it.`
                    },
                    { role: 'user', content: prompt }
                ]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || `API error (HTTP ${response.status})`;
            essayOutput.innerHTML = `<p style="color: #ef4444;">API Error: ${errMsg}</p>`;
            console.error('API Error:', data);
            return;
        }

        if (data.choices && data.choices[0]?.message?.content) {
            let html = data.choices[0].message.content.trim();

            // Clean up any markdown code wrapper that the model sometimes outputs
            html = html.replace(/^```html\s*([\s\S]*?)\s*```$/g, '$1')
                       .replace(/^```\s*([\s\S]*?)\s*```$/g, '$1');
            
            // If the model left an unclosed code block at the start, clean it up
            if (html.startsWith('```html')) {
                html = html.replace(/^```html\s*/, '');
            } else if (html.startsWith('```')) {
                html = html.replace(/^```\s*/, '');
            }
            // Remove any trailing unclosed code block indicators
            if (html.endsWith('```')) {
                html = html.replace(/\s*```$/, '');
            }

            essayOutput.innerHTML = html;
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

