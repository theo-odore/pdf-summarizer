document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    
    // Views
    const viewUpload = document.getElementById('view-upload');
    const viewProcessing = document.getElementById('view-processing');
    const viewResults = document.getElementById('view-results');
    
    // Processing UI
    const processingStatus = document.getElementById('processing-status');
    const progressBar = document.getElementById('progress-bar');
    
    // Output UI
    const outTitle = document.getElementById('out-title');
    const outOverview = document.getElementById('out-overview');
    const outConcepts = document.getElementById('out-concepts');
    const outPoints = document.getElementById('out-points');
    const outDetailed = document.getElementById('out-detailed');
    const outConclusion = document.getElementById('out-conclusion');
    
    // Stats UI
    const statWordsOrg = document.getElementById('stat-words-org');
    const statWordsSum = document.getElementById('stat-words-sum');
    
    // Actions
    const btnCopy = document.getElementById('btn-copy');
    const btnTxt = document.getElementById('btn-txt');
    const btnPdf = document.getElementById('btn-pdf');
    const btnNew = document.getElementById('btn-new');
    const themeToggle = document.getElementById('theme-toggle');
    const toastContainer = document.getElementById('toast-container');

    // State
    let currentRawSummary = null; // Store for raw JSON to use in downloads

    // ---- Theme Handling ----
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    };
    
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });

    initTheme();

    // ---- Toast Notifications ----
    const showToast = (message, isError = false) => {
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        // Trigger reflow for animation
        void toast.offsetWidth;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    // ---- View Switching ----
    const switchView = (targetView) => {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            setTimeout(() => {
                if(!v.classList.contains('active')) v.classList.add('hidden');
            }, 400); // match transition
        });
        
        targetView.classList.remove('hidden');
        // trigger reflow
        void targetView.offsetWidth;
        targetView.classList.add('active');
    };

    // ---- File Upload Handling ----
    const handleFileSelect = async (file) => {
        if (!file) return;
        
        if (file.type !== 'application/pdf') {
            showToast('Please upload a valid PDF document', true);
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
             showToast('File size exceeds 50 MB limit', true);
             return;
        }

        processPDF(file);
    };

    // Drag and Drop Events
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFileSelect(dt.files[0]);
    });

    // ---- Core Processing Logic ----
    const processPDF = async (file) => {
        switchView(viewProcessing);
        
        try {
            // Step 1: Upload and Extract Text
            updateProgress('Uploading and extracting text...', 20);
            
            const formData = new FormData();
            formData.append('pdf', file);

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadRes.ok) {
                const errorData = await uploadRes.json();
                throw new Error(errorData.error || 'Failed to parse PDF');
            }

            const { text, wordCount } = await uploadRes.json();
            statWordsOrg.textContent = wordCount.toLocaleString();

            if (!text || text.trim().length === 0) {
                 throw new Error('No readable text found in this PDF.');
            }

            // Step 2: Send to AI for Summary
            updateProgress('Analyzing content with AI... (this may take a minute)', 60);

            const sumRes = await fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!sumRes.ok) {
                const errorData = await sumRes.json();
                throw new Error(errorData.error || 'AI Summarization failed');
            }

            const summaryObj = await sumRes.json();
            currentRawSummary = summaryObj; // Cache for later
            
            updateProgress('Formatting results...', 90);
            
            // Step 3: Render
            renderSummary(summaryObj);
            
            setTimeout(() => {
                switchView(viewResults);
            }, 500);

        } catch (error) {
            console.error(error);
            showToast(error.message, true);
            switchView(viewUpload);
            // Reset input
            fileInput.value = '';
        }
    };

    const updateProgress = (text, percent) => {
        processingStatus.textContent = text;
        progressBar.style.width = `${percent}%`;
    };

    // ---- UI Rendering ----
    const renderSummary = (data) => {
        // Robust extraction considering LLM slight variations
        
        outTitle.textContent = data.title || 'Untitled Document';
        outOverview.textContent = data.overview || 'No overview generated.';
        
        // Key Concepts
        outConcepts.innerHTML = '';
        if (data.keyConcepts && Array.isArray(data.keyConcepts)) {
            data.keyConcepts.forEach(concept => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="concept-name">${sanitizeHTML(concept.concept)}</span>
                                <span class="concept-desc">${sanitizeHTML(concept.explanation)}</span>`;
                outConcepts.appendChild(li);
            });
        }

        // Important Points
        outPoints.innerHTML = '';
        if (data.importantPoints && Array.isArray(data.importantPoints)) {
            data.importantPoints.forEach(point => {
                const li = document.createElement('li');
                li.textContent = point;
                outPoints.appendChild(li);
            });
        }

        // Detailed Summary
        outDetailed.innerHTML = '';
        if (data.detailedSummary) {
             // Split string by double newline if present to make paragraphs
             const paragraphs = data.detailedSummary.split('\\n\\n');
             paragraphs.forEach(p => {
                 if(p.trim()) {
                     const pEl = document.createElement('p');
                     pEl.textContent = p.trim();
                     outDetailed.appendChild(pEl);
                 }
             });
        }

        outConclusion.textContent = data.conclusion || 'No conclusion generated.';

        // Calculate summary word count rough estimate
        const sumTextRaw = [
            data.title, data.overview, data.detailedSummary, data.conclusion,
            ...(data.importantPoints || []),
            ...(data.keyConcepts || []).map(c => c.concept + ' ' + c.explanation)
        ].join(' ');
        
        statWordsSum.textContent = Math.max(0, sumTextRaw.split(/\s+/).filter(w => w.length > 0).length).toLocaleString();
    };

    const sanitizeHTML = (str) => {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    // ---- Actions ----
    
    // Reset Flow
    btnNew.addEventListener('click', () => {
        fileInput.value = '';
        progressBar.style.width = '0%';
        currentRawSummary = null;
        switchView(viewUpload);
    });

    // Formatting helper
    const buildPlainTextSummary = () => {
        if (!currentRawSummary) return '';
        const d = currentRawSummary;
        let text = `${d.title}\\n`;
        text += '='.repeat(d.title?.length || 10) + '\\n\\n';
        
        text += `OVERVIEW\\n---\\n${d.overview}\\n\\n`;
        
        text += `KEY CONCEPTS\\n---\\n`;
        (d.keyConcepts || []).forEach(c => {
            text += `• ${c.concept}: ${c.explanation}\\n`;
        });
        text += '\\n';
        
        text += `IMPORTANT POINTS\\n---\\n`;
        (d.importantPoints || []).forEach(p => {
            text += `• ${p}\\n`;
        });
        text += '\\n';

        text += `DETAILED SUMMARY\\n---\\n${d.detailedSummary}\\n\\n`;
        
        text += `CONCLUSION\\n---\\n${d.conclusion}\\n`;
        
        return text;
    };

    // Copy to Clipboard
    btnCopy.addEventListener('click', () => {
        const text = buildPlainTextSummary();
        navigator.clipboard.writeText(text).then(() => {
            showToast('Summary copied to clipboard!');
        }).catch(() => {
            showToast('Failed to copy to clipboard', true);
        });
    });

    // Download TXT
    btnTxt.addEventListener('click', () => {
        const text = buildPlainTextSummary();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Summary_${currentRawSummary?.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'document'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Download PDF (via jsPDF)
    btnPdf.addEventListener('click', () => {
        if (!window.jspdf || !currentRawSummary) {
            showToast('PDF generator not available', true);
            return;
        }
        
        showToast('Generating PDF...');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const d = currentRawSummary;
        
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;
        
        // Helper
        const addSection = (title, content, isList = false, listItems = []) => {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(title, margin, y);
            y += 8;
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            
            if (isList) {
                listItems.forEach(item => {
                    const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 5);
                    doc.text(lines, margin + 5, y);
                    y += (lines.length * 5) + 2;
                    if (y > 270) { doc.addPage(); y = margin; }
                });
            } else if (content) {
                const lines = doc.splitTextToSize(content, contentWidth);
                doc.text(lines, margin, y);
                y += (lines.length * 5) + 4;
            }
            y += 5;
            if (y > 270) { doc.addPage(); y = margin; }
        };

        // Title
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(d.title || 'Summary', contentWidth);
        doc.text(titleLines, margin, y);
        y += (titleLines.length * 8) + 10;
        
        addSection('Overview', d.overview);
        
        const conceptItems = (d.keyConcepts || []).map(c => `${c.concept}: ${c.explanation}`);
        if(conceptItems.length > 0) addSection('Key Concepts', null, true, conceptItems);
        
        if(d.importantPoints?.length > 0) addSection('Important Points', null, true, d.importantPoints);
        
        addSection('Detailed Summary', d.detailedSummary);
        addSection('Conclusion', d.conclusion);
        
        doc.save(`Summary_${d.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'document'}.pdf`);
    });
});
