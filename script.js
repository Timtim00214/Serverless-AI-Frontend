// ================= CONFIGURATION =================
// ⚠️ 填入你的 Key 列表，实现轮询
const API_KEYS = [
    'sk-唔姆唔姆口口口滋滋滋唔欸吾欸幺幺幺否否否', 

]; 

const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const MAX_HISTORY = 20; // 限制历史记录轮数

// State
let chatHistory = []; // {role: 'user'|'assistant', content: string}
let isProcessing = false;

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const modelSelect = document.getElementById('modelSelect');
const fileInput = document.getElementById('fileInput');
const currentModelDisplay = document.getElementById('currentModelDisplay');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');

// Init
currentModelDisplay.innerText = modelSelect.value;

// ================= EVENT LISTENERS =================

// Toggle Sidebar (Mobile)
menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});
    // Close Sidebar Logic
document.getElementById('closeSidebarBtn').addEventListener('click', () => {
    sidebar.classList.remove('active');
});

// Model Change
modelSelect.addEventListener('change', (e) => {
    currentModelDisplay.innerText = e.target.value;
    // Optional: Clear history on model switch? User prefer multi-turn? 
    // Let's keep history for now.
});

// Auto-resize Textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value === '') this.style.height = '50px';
});

// Enter to Send
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

sendBtn.addEventListener('click', handleSend);

// File Upload Logic
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        const prefix = `\n[已读取文件: ${file.name}]\n---\n`;
        userInput.value += (userInput.value ? '\n' : '') + prefix + text;
        // Trigger resize
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
        // Clear input so same file can be selected again if needed
        fileInput.value = ''; 
    };
    reader.readAsText(file);
});

// ================= CORE LOGIC =================

function mockHistoryClick() {
    alert("静态页面还想保存聊天记录？想得美（需要保存的聊天记录请自己复制）");
}

async function handleSend() {
    const text = userInput.value.trim();
    if (!text || isProcessing) return;

    // UI Update
    appendMessage('user', text);
    userInput.value = '';
    userInput.style.height = '50px';
    
    isProcessing = true;
    sendBtn.innerText = "思考中...技术原因暂时不支持流式输出，即一个字一个字往外蹦，而且以后页不打算支持（略略略来打我啊）所以请不要关闭此页面，关了聊天记录就都没了哦";
    sendBtn.disabled = true;

    // Prepare Context (Last 20 messages)
    const contextMessages = chatHistory.slice(-MAX_HISTORY);

    // Add temporary loading bubble
    const loadingId = 'loading-' + Date.now();
    appendLoadingBubble(loadingId);

    try {
        // Start API Rotation
        const reply = await fetchWithRetry(contextMessages, 0);
        
        // Remove loading bubble
        document.getElementById(loadingId).remove();
        
        // Append AI response
        appendMessage('ai', reply);

    } catch (error) {
        document.getElementById(loadingId).remove();
        appendMessage('ai', `[系统错误] ${error.message}`);
    } finally {
        isProcessing = false;
        sendBtn.innerText = "发送";
        sendBtn.disabled = false;
    }
}

// Recursive Key Rotation Logic
async function fetchWithRetry(messages, keyIndex) {
    if (keyIndex >= API_KEYS.length) {
        throw new Error("API额度用尽/网站交互功能故障！请联系开发者");
    }

    const currentKey = API_KEYS[keyIndex];
    const model = modelSelect.value;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: false // 流式
            })
        });

        if (!response.ok) {
            // If Rate Limit (429) or Server Error (5xx) or Payment (402) -> Try next key
            if ([429, 402, 500, 503].includes(response.status)) {
                console.warn(`Key ${keyIndex} failed with ${response.status}, trying next...`);
                return await fetchWithRetry(messages, keyIndex + 1);
            }
            const errData = await response.json();
            throw new Error(`API Error: ${errData.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (err) {
        // Network errors also trigger retry
        console.warn(`Network fail on key ${keyIndex}: ${err.message}`);
        // If it's the custom "All keys used" error, rethrow it
        if (err.message.includes("API额度用尽")) throw err;
        return await fetchWithRetry(messages, keyIndex + 1);
    }
}

// ================= UI RENDERING =================

function appendLoadingBubble(id) {
    const div = document.createElement('div');
    div.className = 'message-row ai';
    div.id = id;
    div.innerHTML = `<div class="message-bubble" style="color:#888;">Running inference...</div>`;
    chatContainer.appendChild(div);
    scrollToBottom();
}

function appendMessage(role, text) {
    // Update History
    chatHistory.push({ role: role === 'user' ? 'user' : 'assistant', content: text });

    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    
    // Process Text (Thinking Tag Handling)
    let formattedText = escapeHtml(text);
    
    // Logic for <think> tags folding
    if (role === 'ai') {
        // Replace <think>content</think> with details tag
        // Regex handles multiline properly with [\s\S]
        formattedText = formattedText.replace(
            /&lt;think&gt;([\s\S]*?)&lt;\/think&gt;/gi, 
            '<details class="thinking-process"><summary>深度思考 (点击展开)</summary><p>$1</p></details>'
        );
        // Clean up newlines after closing think tag usually left by models
        formattedText = formattedText.replace(/<\/details>\n+/g, '</details>');
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = formattedText;

    // Actions
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    
    const copyBtn = document.createElement('span');
    copyBtn.className = 'action-btn';
    copyBtn.innerText = '复制';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(text);
        copyBtn.innerText = '已复制!';
        setTimeout(() => copyBtn.innerText = '复制', 1500);
    };

    const delBtn = document.createElement('span');
    delBtn.className = 'action-btn';
    delBtn.innerText = '删除';
    delBtn.onclick = () => {
        row.remove();
        // Note: This only removes from UI, keeping in history array for context continuity 
        // unless we want to do complex splicing. For display purposes, this is enough.
    };

    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);

    row.appendChild(bubble);
    row.appendChild(actions);
    chatContainer.appendChild(row);
    scrollToBottom();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}