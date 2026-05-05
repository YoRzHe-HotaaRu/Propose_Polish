// ============================================
// ProsePolish — App Configuration & State
// ============================================
const API_BASE_URL = (typeof CONFIG_API_URL !== 'undefined') ? CONFIG_API_URL : 'http://localhost:8000';

const state = {
    isTransforming: false,
    lastResult: null,
    progressTimer: null,
    currentProgressStage: 0,
    user: null,
    idToken: null,
    subscription: { tier: 'free', daily_usage: 0, daily_limit: 5 },
};

function getAnonymousUid() {
    var uid = localStorage.getItem('prosepolish-anon-uid');
    if (!uid) {
        uid = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('prosepolish-anon-uid', uid);
    }
    return uid;
}

// ============================================
// Firebase Init
// ============================================
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

try {
    var isFileProtocol = window.location.protocol === 'file:';
    if (isFileProtocol) {
        console.warn('Login disabled: use HTTP server. Run: python -m http.server 3000 --directory frontend');
    } else {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
    }
} catch (e) {
    console.warn('Firebase not configured. Running in offline mode.', e.message);
}

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
    authModalOverlay: $('#auth-modal-overlay'),
    authLogin: $('#auth-login'),
    authSignup: $('#auth-signup'),
    subModalOverlay: $('#sub-modal-overlay'),
    guestLimitModalOverlay: $('#guest-limit-modal-overlay'),
    pricingGrid: $('#pricing-grid'),
    headerUser: $('#header-user'),
    headerLoginBtn: $('#header-login-btn'),
    headerLogoutBtn: $('#header-logout-btn'),
    headerAccountBtn: $('#header-account-btn'),
    headerTierBadge: $('#header-tier-badge'),
    headerUsage: $('#header-usage'),
    subBanner: $('#sub-banner'),
    subBannerText: $('#sub-banner-text'),
    languageBadge: $('#language-badge'),
};

// ============================================
// Firebase Auth State Observer
// ============================================
if (firebaseAuth) {
    firebaseAuth.onAuthStateChanged(function (user) {
        state.user = user;
        if (user) {
            user.getIdToken().then(function (token) {
                state.idToken = token;
                updateAuthUI();
                fetchSubscription();
            });
        } else {
            state.idToken = null;
            state.subscription = { tier: 'free', daily_usage: 0, daily_limit: 5 };
            updateAuthUI();
        }
    });

    firebaseAuth.onIdTokenChanged(function (user) {
        if (user) {
            user.getIdToken().then(function (token) {
                state.idToken = token;
            });
        }
    });
}

// ============================================
// Auth UI Update
// ============================================
function updateAuthUI() {
    if (state.user) {
        dom.headerLoginBtn.style.display = 'none';
        dom.headerAccountBtn.style.display = '';
        dom.headerLogoutBtn.style.display = '';
        var email = state.user.email || 'User';
        dom.headerUser.textContent = email;
        dom.headerUser.style.display = '';
        dom.headerAccountBtn.title = email + ' — Click to manage account';
    } else {
        dom.headerLoginBtn.style.display = '';
        dom.headerAccountBtn.style.display = 'none';
        dom.headerLogoutBtn.style.display = 'none';
        dom.headerUser.style.display = 'none';
        dom.headerTierBadge.style.display = 'none';
        dom.headerUsage.style.display = 'none';
        dom.subBanner.style.display = 'none';
    }
}

function updateSubUI() {
    var s = state.subscription;
    dom.headerTierBadge.textContent = s.tier === 'free' ? 'Free' : s.tier === 'pro' ? 'Pro' : 'Premium';
    dom.headerTierBadge.className = 'header-tier-badge tier-' + s.tier;
    dom.headerTierBadge.style.display = '';

    dom.headerUsage.textContent = s.daily_usage + ' / ' + s.daily_limit;
    dom.headerUsage.style.display = '';

    if (s.tier === 'free' || (s.daily_usage >= s.daily_limit && s.tier !== 'premium')) {
        var remaining = Math.max(0, s.daily_limit - s.daily_usage);
        dom.subBannerText.textContent = remaining === 0
            ? 'Daily limit reached (' + s.daily_usage + '/' + s.daily_limit + '). Upgrade to continue writing.'
            : remaining + ' emails remaining today. Upgrade for more.';
        dom.subBanner.style.display = '';
    } else {
        dom.subBanner.style.display = 'none';
    }
}

// ============================================
// Subscription API
// ============================================
function fetchSubscription() {
    if (!state.idToken) return;
    fetch(API_BASE_URL + '/api/subscription', {
        headers: { 'Authorization': 'Bearer ' + state.idToken },
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            state.subscription = {
                tier: data.current_tier || 'free',
                daily_usage: data.current_usage || 0,
                daily_limit: data.tiers ? data.tiers.find(function (t) { return t.id === (data.current_tier || 'free'); }).daily_limit : 5,
            };
            updateSubUI();
            buildPricingCards(data.tiers || [], data.current_tier || 'free');
        })
        .catch(function () {});
}

function upgradeSubscription(tier) {
    if (!state.idToken) {
        showToast('Please login first', 'error');
        return;
    }
    fetch(API_BASE_URL + '/api/subscription/upgrade?tier=' + encodeURIComponent(tier), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + state.idToken },
    })
        .then(function (r) { return r.json(); })
        .then(function () {
            showToast('Upgraded to ' + tier + '!', 'success');
            closeSubModal();
            fetchSubscription();
        })
        .catch(function () {
            showToast('Upgrade failed', 'error');
        });
}

// ============================================
// Auth Modal
// ============================================
function showAuthModal() {
    if (state.user) {
        showSubModal();
        return;
    }
    dom.authModalOverlay.style.display = '';
    switchAuthTab('login');
}

function closeAuthModal() {
    dom.authModalOverlay.style.display = 'none';
}

function switchAuthTab(tab) {
    if (tab === 'login') {
        dom.authLogin.style.display = '';
        dom.authSignup.style.display = 'none';
    } else {
        dom.authLogin.style.display = 'none';
        dom.authSignup.style.display = '';
    }
}

function handleLogin(e) {
    if (!firebaseAuth) { showToast('Login unavailable — use HTTP server', 'error'); return; }
    e.preventDefault();
    var email = $('#login-email').value;
    var password = $('#login-password').value;
    var btn = $('#login-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    firebaseAuth.signInWithEmailAndPassword(email, password)
        .then(function () {
            closeAuthModal();
            showToast('Logged in successfully!', 'success');
        })
        .catch(function (err) {
            showToast('Error: ' + err.message, 'error');
        })
        .finally(function () {
            btn.disabled = false;
            btn.textContent = 'Login';
        });
}

function handleSignup(e) {
    if (!firebaseAuth) { showToast('Signup unavailable — use HTTP server', 'error'); return; }
    e.preventDefault();
    var email = $('#signup-email').value;
    var password = $('#signup-password').value;
    var btn = $('#signup-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Signing up...';
    firebaseAuth.createUserWithEmailAndPassword(email, password)
        .then(function () {
            closeAuthModal();
            showToast('Account created successfully!', 'success');
        })
        .catch(function (err) {
            showToast('Error: ' + err.message, 'error');
        })
        .finally(function () {
            btn.disabled = false;
            btn.textContent = 'Sign Up';
        });
}

function handleGoogleLogin() {
    if (!firebaseAuth) { showToast('Google login unavailable — use HTTP server', 'error'); return; }
    var provider = new firebase.auth.GoogleAuthProvider();
    firebaseAuth.signInWithPopup(provider)
        .then(function () {
            closeAuthModal();
            showToast('Logged in successfully!', 'success');
        })
        .catch(function (err) {
            showToast('Error: ' + err.message, 'error');
        });
}

function handleLogout() {
    if (!firebaseAuth) return;
    firebaseAuth.signOut().then(function () {
        showToast('Logged out successfully', 'success');
    });
}

// ============================================
// Subscription Modal
// ============================================
function showSubModal() {
    dom.subModalOverlay.style.display = '';
    fetchSubscription();
}

function closeSubModal() {
    dom.subModalOverlay.style.display = 'none';
}

function showGuestLimitModal() {
    dom.guestLimitModalOverlay.style.display = '';
}

function closeGuestLimitModal() {
    dom.guestLimitModalOverlay.style.display = 'none';
}

function buildPricingCards(tiers, currentTier) {
    if (!tiers || !tiers.length) return;
    var tierOrder = { free: 0, pro: 1, premium: 2 };
    var currentLevel = tierOrder[currentTier] || 0;
    var html = '';
    for (var i = 0; i < tiers.length; i++) {
        var t = tiers[i];
        var isCurrent = t.id === currentTier;
        var isLower = (tierOrder[t.id] || 0) < currentLevel;
        var priceText = t.price_rm === 0 ? 'FREE' : 'RM ' + t.price_rm.toFixed(2) + ' / month';
        var ctaText;
        var disabled = false;
        if (isCurrent) {
            ctaText = 'Current';
            disabled = true;
        } else if (isLower) {
            ctaText = 'Unavailable';
            disabled = true;
        } else {
            ctaText = t.price_rm === 0 ? 'Start Free' : 'Select';
        }
        var featuresHtml = '';
        for (var j = 0; j < t.features.length; j++) {
            featuresHtml += '<li>' + t.features[j] + '</li>';
        }
        html += '<div class="pricing-card' + (isCurrent ? ' pricing-current' : '') + (isLower ? ' pricing-lower' : '') + '">';
        html += '<h3 class="pricing-name">' + t.name + '</h3>';
        html += '<div class="pricing-price">' + priceText + '</div>';
        html += '<p class="pricing-limit">' + t.daily_limit + ' emails / day</p>';
        html += '<ul class="pricing-features">' + featuresHtml + '</ul>';
        html += '<button class="pricing-btn' + (disabled ? ' pricing-btn-disabled' : '') + '" onclick="upgradeSubscription(\'' + t.id + '\')"' + (disabled ? ' disabled' : '') + '>' + ctaText + '</button>';
        html += '</div>';
    }
    dom.pricingGrid.innerHTML = html;
}

// ============================================
// Settings Label Update
// ============================================
function updateSettingsLabel() {
    var tone = dom.toneSelect.options[dom.toneSelect.selectedIndex].text;
    var length = dom.lengthSelect.options[dom.lengthSelect.selectedIndex].text;
    var recipient = dom.recipientSelect.options[dom.recipientSelect.selectedIndex].text;
    dom.settingsLabel.textContent = tone + ' \u00b7 ' + length + ' \u00b7 ' + recipient;
}

dom.toneSelect.addEventListener('change', updateSettingsLabel);
dom.lengthSelect.addEventListener('change', updateSettingsLabel);
dom.recipientSelect.addEventListener('change', updateSettingsLabel);

// ============================================
// Character Count
// ============================================
function updateCharCount() {
    var len = dom.casualInput.value.length;
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
    var icon = type === 'success' ? '\u2713' : type === 'error' ? '\u2715' : '\u2139';
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

    var headers = { 'Content-Type': 'application/json' };
    if (state.idToken) {
        headers['Authorization'] = 'Bearer ' + state.idToken;
    } else {
        headers['X-Anonymous-UID'] = getAnonymousUid();
    }

    fetch(API_BASE_URL + '/api/transform', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
    })
        .then(function (response) {
            if (response.status === 429) {
                return response.json().then(function (d) {
                    var detail = d.detail || 'Daily limit reached';
                    if (!state.idToken && firebaseAuth) {
                        // Guest hit their 1/day limit — show registration popup
                        showGuestLimitModal();
                    } else {
                        showToast(detail, 'error');
                    }
                    throw new Error('LIMIT');
                });
            }
            if (response.status === 401) {
                state.idToken = null;
                showToast('Session expired. Please login again.', 'error');
                showAuthModal();
                throw new Error('AUTH');
            }
            if (!response.ok) {
                throw new Error('Server responded with ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (data) updateUI(data);
            fetchSubscription();
        })
        .catch(function (err) {
            if (err.message === 'AUTH') {
                showState('empty');
            } else if (err.message === 'LIMIT') {
                showState('empty');
            } else {
                showError(err.message || 'Network error. Please check your connection and try again.');
            }
        })
        .finally(function () {
            state.isTransforming = false;
            dom.transformBtn.disabled = false;
            dom.transformBtnText.textContent = 'Transform';
            if (sparkle) sparkle.style.display = '';
            if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
            showProgress(false);

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

function extractSubject(text) {
    if (!text) return null;
    var match = text.match(/^Subject:\s*(.+)$/im);
    return match ? match[1].trim() : null;
}

function generateSubject(analysis) {
    if (!analysis) return null;
    if (analysis.suggested_subject) return analysis.suggested_subject;
    if (analysis.intent) {
        var intent = analysis.intent.charAt(0).toUpperCase() + analysis.intent.slice(1);
        return intent + ' — Follow-up';
    }
    return null;
}

function formatAnalysis(analysis) {
    if (!analysis) return 'No analysis available.';
    var parts = [];
    if (analysis.intent) parts.push('Intent: ' + analysis.intent);
    if (analysis.urgency) parts.push('Urgency: ' + analysis.urgency);
    if (analysis.target_tone) parts.push('Target Tone: ' + analysis.target_tone);
    if (analysis.key_points && analysis.key_points.length) {
        parts.push('Key Points: ' + analysis.key_points.join(', '));
    }
    if (analysis.language) parts.push('Language: ' + analysis.language);
    return parts.length ? parts.join('\n') : 'No analysis available.';
}

function formatQcReview(qcOutput) {
    if (!qcOutput || typeof qcOutput !== 'object') return String(qcOutput || 'No QC review.');
    var lines = [];
    if (qcOutput.score !== undefined) lines.push('Score: ' + qcOutput.score + '/10');
    if (qcOutput.feedback) lines.push('Feedback: ' + qcOutput.feedback);
    return lines.length ? lines.join('\n') : 'No QC review.';
}

function updateUI(data) {
    if (data && data.error) {
        showError(data.error);
        return;
    }

    state.lastResult = data;
    showState('result');

    var recipientText = dom.recipientSelect.options[dom.recipientSelect.selectedIndex].text;
    dom.emailTo.textContent = capitalize(recipientText);

    var subject = extractSubject(data.final_email);
    if (!subject) {
        subject = generateSubject(data.analysis);
    }
    dom.emailSubject.textContent = subject || '(No subject)';

    var body = data.final_email || '';
    body = body.replace(/^Subject:\s*.+(?:\r?\n)?/i, '').trim();
    dom.emailBody.textContent = body;

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

    var steps = data.intermediate_steps;
    dom.stepContextBody.textContent = formatAnalysis(data.analysis);
    dom.stepDraftBody.textContent = findStage(steps, 'draft') || 'No draft available.';
    dom.stepPolishedBody.textContent = findStage(steps, 'polished') || 'No polished version available.';

    var qcOutput = findStage(steps, 'qc_review');
    dom.stepQcBody.textContent = formatQcReview(qcOutput);

    if (data.language && data.language !== 'en') {
        dom.languageBadge.textContent = data.language.toUpperCase();
        dom.languageBadge.style.display = '';
    } else {
        dom.languageBadge.style.display = 'none';
    }
}

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

    if (content.style.display === 'none') {
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
// Theme Toggle
// ============================================
function toggleTheme() {
    var root = document.documentElement;
    if (root.classList.contains('dark')) {
        root.classList.remove('dark');
        localStorage.setItem('prosepolish-theme', 'light');
    } else {
        root.classList.add('dark');
        localStorage.setItem('prosepolish-theme', 'dark');
    }
}

function initTheme() {
    var saved = localStorage.getItem('prosepolish-theme');
    if (saved === 'dark') {
        document.documentElement.classList.add('dark');
    }
}

// ============================================
// Modal Overlay Click to Close
// ============================================
dom.authModalOverlay.addEventListener('click', function (e) {
    if (e.target === dom.authModalOverlay) closeAuthModal();
});
dom.subModalOverlay.addEventListener('click', function (e) {
    if (e.target === dom.subModalOverlay) closeSubModal();
});
dom.guestLimitModalOverlay.addEventListener('click', function (e) {
    if (e.target === dom.guestLimitModalOverlay) closeGuestLimitModal();
});

// ============================================
// Initialization
// ============================================
initTheme();
updateSettingsLabel();
updateCharCount();
