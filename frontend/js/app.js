// ============================================
// ProsePolish — App Configuration & State
// ============================================
const API_BASE_URL = (typeof CONFIG_API_URL !== 'undefined') ? CONFIG_API_URL : 'http://localhost:8000';

const state = {
    isTransforming: false,
    lastResult: null,
    progressTimer: null,
    currentProgressStage: 0,
};

// ============================================
// DOM References
// ============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    toneSelect: $('#tone-select'),
    lengthSelect: $('#length-select'),
    recipientSelect: $('#recipient-select'),
    transformBtn: $('#transform-btn'),
    transformBtnText: $('#transform-btn-text'),
    casualInput: $('#casual-input'),
    charCount: $('#char-count'),
    settingsLabel: $('#settings-label'),
    emptyState: $('#empty-state'),
    resultState: $('#result-state'),
    loadingState: $('#loading-state'),
    errorState: $('#error-state'),
    errorMessage: $('#error-message'),
    emailTo: $('#email-to'),
    emailSubject: $('#email-subject'),
    emailBody: $('#email-body'),
    scoreBadge: $('#score-badge'),
    scoreValue: $('#score-value'),
    progressStages: $('#progress-stages'),
    intermediateSection: $('#intermediate-section'),
    intermediateContent: $('#intermediate-content'),
    toggleIcon: $('#toggle-icon'),
    stepContextBody: $('#step-context-body'),
    stepDraftBody: $('#step-draft-body'),
    stepPolishedBody: $('#step-polished-body'),
    stepQcBody: $('#step-qc-body'),
    toastContainer: $('#toast-container'),
};

// ============================================
// Settings Label Update
// ============================================
function updateSettingsLabel() {
    const tone = dom.toneSelect.options[dom.toneSelect.selectedIndex].text;
    const length = dom.lengthSelect.options[dom.lengthSelect.selectedIndex].text;
    const recipient = dom.recipientSelect.options[dom.recipientSelect.selectedIndex].text;
    dom.settingsLabel.textContent = `${tone} · ${length} · ${recipient}`;
}

dom.toneSelect.addEventListener('change', updateSettingsLabel);
dom.lengthSelect.addEventListener('change', updateSettingsLabel);
dom.recipientSelect.addEventListener('change', updateSettingsLabel);

// ============================================
// Character Count
// ============================================
function updateCharCount() {
    const len = dom.casualInput.value.length;
    dom.charCount.textContent = len;
    if (len > 4500) {
        dom.charCount.style.color = '#ea4335';
    } else if (len > 3500) {
        dom.charCount.style.color = '#f9ab00';
    } else {
        dom.charCount.style.color = '';
    }
}

// ============================================
// State Visibility Helpers
// ============================================
function showState(stateName) {
    dom.emptyState.style.display = 'none';
    dom.resultState.style.display = 'none';
    dom.loadingState.style.display = 'none';
    dom.errorState.style.display = 'none';
    dom.intermediateSection.style.display = 'none';
    dom.intermediateContent.style.display = 'none';

    switch (stateName) {
        case 'empty':
            dom.emptyState.style.display = '';
            break;
        case 'result':
            dom.resultState.style.display = '';
            dom.intermediateSection.style.display = '';
            break;
        case 'loading':
            dom.loadingState.style.display = '';
            break;
        case 'error':
            dom.errorState.style.display = '';
            break;
    }
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type) {
    type = type || 'default';
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    var icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = '<span>' + icon + '</span><span>' + message + '</span>';
    dom.toastContainer.appendChild(toast);

    setTimeout(function () {
        toast.classList.add('toast-removing');
        setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ============================================
// Copy to Clipboard
// ============================================
function copyToClipboard() {
    if (!state.lastResult) return;

    var recipient = dom.emailTo.textContent;
    var subject = dom.emailSubject.textContent;
    var body = dom.emailBody.textContent;
    var fullText = 'To: ' + recipient + '\nSubject: ' + subject + '\n\n' + body;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullText).then(function () {
            showToast('Copied to clipboard', 'success');
        }).catch(function () {
            fallbackCopy(fullText);
        });
    } else {
        fallbackCopy(fullText);
    }
}

function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Copied to clipboard', 'success');
    } catch (e) {
        showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textarea);
}

// ============================================
// Progress Animation
// ============================================
function showProgress(active) {
    if (!active) {
        if (state.progressTimer) {
            clearInterval(state.progressTimer);
            state.progressTimer = null;
        }
        state.currentProgressStage = 0;
        return;
    }

    var stages = dom.progressStages.querySelectorAll('.progress-stage');
    stages.forEach(function (s) {
        s.classList.remove('active', 'completed');
    });

    state.currentProgressStage = 0;
    stages[0].classList.add('active');

    function advanceStage() {
        var current = stages[state.currentProgressStage];
        current.classList.remove('active');
        current.classList.add('completed');

        state.currentProgressStage++;

        if (state.currentProgressStage < stages.length) {
            stages[state.currentProgressStage].classList.add('active');
        }
    }

    state.progressTimer = setInterval(function () {
        if (state.currentProgressStage < stages.length) {
            advanceStage();
        } else {
            clearInterval(state.progressTimer);
            state.progressTimer = null;
        }
    }, 800);
}

// ============================================
// Debounce
// ============================================
function debounce(fn, delay) {
    var timer = null;
    return function () {
        var context = this;
        var args = arguments;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
            fn.apply(context, args);
        }, delay);
    };
}

// ============================================
// Transform Button Handler
// ============================================
var transformText = debounce(function transformTextInternal() {
    if (state.isTransforming) return;

    var casualText = dom.casualInput.value.trim();
    if (!casualText) {
        showToast('Please enter some text first', 'error');
        return;
    }

    state.isTransforming = true;
    dom.transformBtn.disabled = true;
    dom.transformBtnText.textContent = 'Transforming...';

    // Add spinner
    var sparkle = dom.transformBtn.querySelector('.btn-sparkle');
    if (sparkle) {
        sparkle.style.display = 'none';
    }
    var spinner = document.createElement('span');
    spinner.className = 'btn-spinner';
    dom.transformBtn.insertBefore(spinner, dom.transformBtnText);

    showState('loading');
    showProgress(true);

    var payload = {
        text: casualText,
        tone: dom.toneSelect.value,
        length: dom.lengthSelect.value,
        recipient: dom.recipientSelect.value,
    };

    fetch(API_BASE_URL + '/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Server responded with ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            updateUI(data);
        })
        .catch(function (err) {
            showError(err.message || 'Network error. Please check your connection and try again.');
        })
        .finally(function () {
            state.isTransforming = false;
            dom.transformBtn.disabled = false;
            dom.transformBtnText.textContent = 'Transform';
            if (sparkle) sparkle.style.display = '';
            if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
            showProgress(false);

            // Complete all stages
            var stages = dom.progressStages.querySelectorAll('.progress-stage');
            stages.forEach(function (s) {
                s.classList.add('completed');
                s.classList.remove('active');
            });
        });
}, 500);

// ============================================
// Helper: Find a stage in intermediate_steps array
// ============================================
function findStage(steps, stageName) {
    if (!steps || !Array.isArray(steps)) return '';
    for (var i = 0; i < steps.length; i++) {
        if (steps[i].stage === stageName) {
            return steps[i].output;
        }
    }
    return '';
}

// ============================================
// Helper: Extract subject from email text
// ============================================
function extractSubject(text) {
    if (!text) return null;
    var match = text.match(/^Subject:\s*(.+)$/im);
    return match ? match[1].trim() : null;
}

// ============================================
// Helper: Generate subject from analysis intent
// ============================================
function generateSubject(analysis) {
    if (!analysis || !analysis.intent) return null;
    var intent = analysis.intent;
    return 'Regarding your ' + intent;
}

// ============================================
// Helper: Format analysis object as readable text
// ============================================
function formatAnalysis(analysis) {
    if (!analysis) return 'No analysis available.';
    var parts = [];
    if (analysis.intent) parts.push('Intent: ' + analysis.intent);
    if (analysis.urgency) parts.push('Urgency: ' + analysis.urgency);
    if (analysis.target_tone) parts.push('Target Tone: ' + analysis.target_tone);
    if (analysis.key_points && analysis.key_points.length) {
        parts.push('Key Points: ' + analysis.key_points.join(', '));
    }
    return parts.length ? parts.join('\n') : 'No analysis available.';
}

// ============================================
// Helper: Format QC review output
// ============================================
function formatQcReview(qcOutput) {
    if (!qcOutput || typeof qcOutput !== 'object') return String(qcOutput || 'No QC review.');
    var lines = [];
    if (qcOutput.score !== undefined) lines.push('Score: ' + qcOutput.score + '/10');
    if (qcOutput.feedback) lines.push('Feedback: ' + qcOutput.feedback);
    return lines.length ? lines.join('\n') : 'No QC review.';
}

// ============================================
// Update UI with API Response
// ============================================
function updateUI(data) {
    if (data && data.error) {
        showError(data.error);
        return;
    }

    state.lastResult = data;
    showState('result');

    // To field — derive from UI state since backend doesn't return it
    var recipientText = dom.recipientSelect.options[dom.recipientSelect.selectedIndex].text;
    dom.emailTo.textContent = capitalize(recipientText);

    // Subject — extract from final_email, or generate from analysis, or fallback
    var subject = extractSubject(data.final_email);
    if (!subject) {
        subject = generateSubject(data.analysis);
    }
    dom.emailSubject.textContent = subject || '(No subject)';

    // Body — use final_email, strip any leading "Subject:" line
    var body = data.final_email || '';
    body = body.replace(/^Subject:\s*.+(?:\r?\n)?/i, '').trim();
    dom.emailBody.textContent = body;

    // Score badge
    var score = data.score;
    if (typeof score === 'number') {
        dom.scoreValue.textContent = score;
        dom.scoreBadge.className = 'score-badge';
        if (score >= 8) {
            dom.scoreBadge.classList.add('score-high');
        } else if (score >= 5) {
            dom.scoreBadge.classList.add('score-mid');
        } else {
            dom.scoreBadge.classList.add('score-low');
        }
    } else {
        dom.scoreValue.textContent = '\u2014';
        dom.scoreBadge.className = 'score-badge';
    }

    // Intermediate steps — map from backend's analysis and intermediate_steps
    var steps = data.intermediate_steps;
    dom.stepContextBody.textContent = formatAnalysis(data.analysis);
    dom.stepDraftBody.textContent = findStage(steps, 'draft') || 'No draft available.';
    dom.stepPolishedBody.textContent = findStage(steps, 'polished') || 'No polished version available.';

    var qcOutput = findStage(steps, 'qc_review');
    dom.stepQcBody.textContent = formatQcReview(qcOutput);
}

// ============================================
// Show Error
// ============================================
function showError(message) {
    showState('error');
    dom.errorMessage.textContent = message || 'Something went wrong. Please try again.';
    showToast(message, 'error');
}

// ============================================
// Toggle Intermediate Steps
// ============================================
function toggleIntermediateSteps() {
    var content = dom.intermediateContent;
    var icon = dom.toggleIcon;

    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = '';
        icon.classList.add('open');
    } else {
        content.style.display = 'none';
        icon.classList.remove('open');
    }
}

// ============================================
// Utility
// ============================================
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// Initialization
// ============================================
updateSettingsLabel();
updateCharCount();
