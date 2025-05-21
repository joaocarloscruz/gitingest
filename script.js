document.addEventListener('DOMContentLoaded', () => {
    function injectThemeStyles() {
        const styleElement = document.createElement('style');
        styleElement.id = 'injected-theme-styles'; // Good for identification
        styleElement.innerHTML = `
/* Injected Styles */
:root {
    --color-background: #FFFFFF;
    --color-text: #212529;
    --color-primary: #007ACC;
    --color-primary-dark: #005FA3;
    --color-secondary: #5A6268;
    --color-secondary-dark: #495057;
    --color-success: #28A745;
    --color-success-dark: #218838;
    --color-danger: #DC3545;
    --color-warning: #FFC107;
    --color-info: #17A2B8;
    --color-light: #F0F0F0; /* Lighter Gray for code bg, slider track */
    --color-dark: #1A1A1A; /* For h1 text, etc. */
    --color-border: #DEE2E6;
    --color-input-bg: #FFFFFF;
    --color-input-focus-bg: #E6F2FF;
    --color-card-bg: #F8F9FA;
    /* Preserving existing font and layout vars by not redefining them here,
       assuming they will be picked up from style.css or default browser styles.
       If they are missing, they might need to be added. */
    --font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --border-radius: 0.375rem;
    --box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
    --box-shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.1);
    --code-text-color: #c7254e;
}

body[data-theme="dark"] {
    --color-background: #1A1A1A;
    --color-text: #E0E0E0;
    --color-primary: #008AE6;
    --color-primary-dark: #006BB3;
    --color-secondary: #ADB5BD;
    --color-secondary-dark: #8A9197;
    --color-success: #30C050;
    --color-success-dark: #28A745;
    --color-danger: #E84555;
    --color-warning: #FFCA2C;
    --color-info: #20BACF;
    --color-light: #3A3A3A; 
    --color-dark: #F0F0F0; 
    --color-border: #495057;
    --color-input-bg: #2C2C2C;
    --color-input-focus-bg: #3E4E60;
    --color-card-bg: #2C2C2C;
    --box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    --box-shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.25);
    --code-text-color: #ef708e; 
}

header {
    display: flex;
    flex-direction: row; /* Align items in a row */
    justify-content: space-between; /* Push title and toggle to opposite ends */
    align-items: center; /* Vertically align items in the center */
    margin-bottom: 30px; /* Keep existing margin */
    padding-bottom: 20px; /* Keep existing padding */
    border-bottom: 1px solid var(--color-border); /* Keep existing border */
}

header h1 {
    margin-bottom: 0; /* Remove default margin from h1 if it affects alignment */
    text-align: left; /* Ensure title text is aligned left */
}

h1 span.icon { /* Preserved from original styles */
    display: inline-block; 
    vertical-align: middle; 
    margin-right: 10px; 
    font-size: 0.9em; 
}

.theme-toggle {
    background-color: var(--color-secondary); /* Base background */
    border: 1px solid var(--color-secondary-dark);
    color: #fff; /* Icon/text color */
    padding: 0.375rem 0.75rem; /* Adjust padding for a more compact look if desired */
    border-radius: 20px; /* Rounded ends for slider appearance */
    font-size: 1.2rem; /* Make icons a bit larger */
    line-height: 1; /* Ensure icon is centered vertically */
    cursor: pointer;
    transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
    min-width: 50px; /* Ensure it has some width for the icon */
    text-align: center;
    margin-left: 0; 
}

.theme-toggle:hover {
    background-color: var(--color-secondary-dark);
    border-color: var(--color-primary); /* Highlight on hover */
}

body[data-theme='light'] .theme-toggle {
    background-color: var(--color-warning); /* Sunny yellow */
    border-color: var(--color-warning);
    color: var(--color-dark); /* Dark icon on light yellow */
}
body[data-theme='light'] .theme-toggle:hover {
    background-color: #ffda60; /* Lighter yellow for hover */
}

body[data-theme='dark'] .theme-toggle {
    background-color: var(--color-primary); /* Cool blue for night */
    border-color: var(--color-primary);
    color: #fff; /* White icon on blue */
}
body[data-theme='dark'] .theme-toggle:hover {
    background-color: var(--color-primary-dark);
}

/* General button styling from original style.css (ensure it's present or add if missing) */
.button {
    display: inline-block;
    font-weight: 500;
    text-align: center;
    vertical-align: middle;
    cursor: pointer;
    user-select: none;
    border: 1px solid transparent;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    line-height: 1.5;
    border-radius: var(--border-radius);
    transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}
.button.primary {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: #FFFFFF;
}
.button.primary:hover {
    background-color: var(--color-primary-dark);
    border-color: var(--color-primary-dark);
    color: #FFFFFF;
}

/* Modify .button.secondary to use --color-info */
.button.secondary { 
    background-color: var(--color-info);
    border-color: var(--color-info);
    color: #fff;
}
.button.secondary:hover:not(:disabled) {
    background-color: var(--color-info); 
    opacity: 0.85; 
    border-color: var(--color-info); 
}

/* Specific style for Copy button to use --color-success */
#copyButton.button.secondary {
     background-color: var(--color-success);
     border-color: var(--color-success);
     color: #fff; /* Ensure text is white */
}
#copyButton.button.secondary:hover:not(:disabled) {
     background-color: var(--color-success-dark);
     border-color: var(--color-success-dark);
     opacity: 1; /* Reset opacity */
}

.output-footer {
    display: flex;
    justify-content: space-between; 
    align-items: center;
    margin-top: 5px; /* Keep existing margin-top */
    gap: 10px; /* Use gap for spacing */
}
.output-footer button { 
    margin-left: 0; /* Remove individual margins if gap is used */
}
        `;
        document.head.appendChild(styleElement);
    }

    injectThemeStyles(); // Call the function

    // --- Theme Handling ---
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const THEME_KEY = 'themePreference'; // For localStorage

    function applyTheme(theme) {
        document.body.dataset.theme = theme;
        if (themeToggleButton) {
            themeToggleButton.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    function toggleTheme() {
        const currentTheme = document.body.dataset.theme || 'light'; // Default to light
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
    }

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    }

    // Load saved theme or default
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme('light'); // Default to light
    }

    // --- UI Elements ---
    const modeLocalRadio = document.getElementById('modeLocal');
    const modeUrlRadio = document.getElementById('modeUrl');
    const localModeSection = document.getElementById('localModeSection');
    const urlModeSection = document.getElementById('urlModeSection');
    const folderInput = document.getElementById('folderInput');
    const localStatusDisplay = document.getElementById('localStatus');
    const urlInput = document.getElementById('urlInput');
    const fetchUrlButton = document.getElementById('fetchUrlButton');
    const urlStatusDisplay = document.getElementById('urlStatus');
    const outputArea = document.getElementById('output');
    const copyButton = document.getElementById('copyButton');
    const downloadButton = document.getElementById('downloadButton');
    const filterModeSelect = document.getElementById('filterMode');
    const filterPatternsInput = document.getElementById('filterPatterns');
    const maxSizeSlider = document.getElementById('maxSizeSlider');
    const maxSizeValueDisplay = document.getElementById('maxSizeValue');
    const finalStatusDisplay = document.getElementById('finalStatus'); // Span for final summary

    // --- Configuration ---
    let currentMaxSizeBytes = parseInt(maxSizeSlider.value) * 1024;
    let currentInputMode = 'local'; // 'local' or 'url'

    // GitHub API limits content fetching via contents endpoint to 1MB
    const GITHUB_API_MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

    const BINARY_EXTENSIONS = new Set([ /* ... (keep existing list) ... */
        // Images
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', '.webp',
        // Documents
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
        // Archives
        '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.iso', '.dmg',
        // Executables/Binaries
        '.exe', '.dll', '.so', '.dylib', '.app', '.bin', '.msi',
        // Audio/Video
        '.mp3', '.wav', '.ogg', '.flac', '.aac', '.mp4', '.avi', '.mov', '.webm', '.mkv', '.wmv',
        // Java/Python Bytecode
        '.class', '.jar', '.pyc', '.pyd',
        // Lock files & Build artifacts
        '.lock', '.lockb', '.package-lock.json',
        // Assets/Fonts
        '.svg', '.woff', '.woff2', '.ttf', '.otf', '.eot',
        // Database files
        '.sqlite', '.db', '.mdb',
        // Others
        '.DS_Store', 'Thumbs.db'
    ]);

    const ALWAYS_IGNORE_PATTERNS = [ /* ... (keep existing list) ... */
        '.git/', '.svn/', '.hg/', 'node_modules/', 'bower_components/', 'vendor/',
        'dist/', 'build/', 'out/', 'target/', 'coverage/', '__pycache__/', '*.pyc',
        '.DS_Store', 'Thumbs.db', '.env', '.idea/', '.vscode/', '*.log', '*.tmp', '*.temp'
    ].map(p => ({ pattern: p, isDir: p.endsWith('/') }));

    let gitignoreRules = [];
    let userFilterPatterns = [];
    let currentFilterMode = filterModeSelect.value;

    // --- Event Listeners ---
    modeLocalRadio.addEventListener('change', handleModeChange);
    modeUrlRadio.addEventListener('change', handleModeChange);
    folderInput.addEventListener('change', handleFolderSelect);
    fetchUrlButton.addEventListener('click', handleUrlFetch); // New handler for URL fetch
    copyButton.addEventListener('click', copyOutputToClipboard);
    if (downloadButton) {
        downloadButton.addEventListener('click', downloadOutput);
    }
    maxSizeSlider.addEventListener('input', updateMaxSize);
    filterModeSelect.addEventListener('change', () => { currentFilterMode = filterModeSelect.value; });

    // --- Initial Setup ---
    handleModeChange(); // Set initial UI state based on default checked radio
    updateMaxSize(); // Set initial slider display and value

    // --- Mode Switching ---
    function handleModeChange() {
        currentInputMode = document.querySelector('input[name="inputMode"]:checked').value;
        if (currentInputMode === 'local') {
            localModeSection.style.display = 'block';
            urlModeSection.style.display = 'none';
            localStatusDisplay.textContent = 'No folder selected.'; // Reset status
            urlStatusDisplay.textContent = 'Enter a public GitHub repository URL.';
        } else { // url mode
            localModeSection.style.display = 'none';
            urlModeSection.style.display = 'block';
            localStatusDisplay.textContent = 'Local folder input disabled.';
            urlStatusDisplay.textContent = 'Enter a public GitHub repository URL.'; // Reset status
        }
        // Clear output and reset button when mode changes
        outputArea.value = '';
        copyButton.disabled = true;
        finalStatusDisplay.textContent = '';
    }

    // --- Max Size Handling ---
    function updateMaxSize() {
        const kbValue = parseInt(maxSizeSlider.value);
        currentMaxSizeBytes = kbValue * 1024;
        maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
        updateSliderBackground();
    }

    function updateSliderBackground() {
        const percentage = (parseInt(maxSizeSlider.value) / parseInt(maxSizeSlider.max)) * 100;
        maxSizeSlider.style.setProperty('--value-percent', `${percentage}%`);
    }

    // --- Status Updates ---
    function setStatus(message, isError = false, mode = currentInputMode) {
        let displayElement = finalStatusDisplay; // Default to final status

        if (mode === 'local' && localStatusDisplay) {
            displayElement = localStatusDisplay;
        } else if (mode === 'url' && urlStatusDisplay) {
            displayElement = urlStatusDisplay;
        }
        // If setting final status, use the dedicated span
        if (message.startsWith('✅') || message.startsWith('❌')) {
             displayElement = finalStatusDisplay;
             // Optionally clear the mode-specific status
             if(localStatusDisplay) localStatusDisplay.textContent = '';
             if(urlStatusDisplay) urlStatusDisplay.textContent = '';
        }


        if (displayElement) {
            displayElement.textContent = message;
            displayElement.style.color = isError ? 'var(--color-danger)' : 'var(--color-secondary)'; // Use CSS variables
        }
        console.log(message); // Log status to console as well
        if (isError) {
            console.error(message);
        }
    }

    // --- Core Logic: Local Folder ---
    async function handleFolderSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            setStatus('No folder selected or folder is empty.', false, 'local');
            outputArea.value = '';
            copyButton.disabled = true;
            return;
        }

        setStatus('⏳ Preparing... Reading filters...', false, 'local');
        outputArea.value = 'Processing... Please wait.\n';
        copyButton.disabled = true;
        finalStatusDisplay.textContent = ''; // Clear final status
        gitignoreRules = [];
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
        currentFilterMode = filterModeSelect.value;

        const sortedFiles = Array.from(files).sort((a, b) => {
            if (a.webkitRelativePath.split('/').length === 2 && a.name === '.gitignore') return -1;
            if (b.webkitRelativePath.split('/').length === 2 && b.name === '.gitignore') return 1;
            return a.webkitRelativePath.localeCompare(b.webkitRelativePath);
        });

        const rootGitignoreFile = sortedFiles.find(f => f.webkitRelativePath.split('/').length === 2 && f.name === '.gitignore');
        if (rootGitignoreFile) {
            try {
                setStatus('⏳ Reading root .gitignore...', false, 'local');
                const gitignoreContent = await readFileContentLocal(rootGitignoreFile, 1 * 1024 * 1024); // Limit gitignore read size
                gitignoreRules = parseGitignore(gitignoreContent);
                setStatus(`ℹ️ Found ${gitignoreRules.length} rules in .gitignore. Processing files...`, false, 'local');
            } catch (error) {
                console.error("Error reading local .gitignore:", error);
                setStatus('⚠️ Could not read root .gitignore, proceeding without it.', true, 'local');
            }
        } else {
            setStatus('ℹ️ No root .gitignore found. Processing files...', false, 'local');
        }
        await new Promise(resolve => setTimeout(resolve, 50));

        let processedFileCount = 0;
        let ignoredFileCount = 0;
        let readErrorCount = 0;
        const totalFiles = sortedFiles.length;
        const fileProcessingPromises = [];

        setStatus(`🔎 Analyzing ${totalFiles} local items...`, false, 'local');
        await new Promise(resolve => setTimeout(resolve, 0));

        for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            if (!file.webkitRelativePath) { ignoredFileCount++; continue; }
            const filePath = file.webkitRelativePath;
            const firstSlashIndex = filePath.indexOf('/');
            const relativePathInRepo = firstSlashIndex !== -1 ? filePath.substring(firstSlashIndex + 1) : filePath;

            if (!shouldProcessFile(relativePathInRepo, file.size, file.name)) {
                ignoredFileCount++;
                continue;
            }

            fileProcessingPromises.push(
                readFileContentLocal(file)
                    .then(content => ({ path: relativePathInRepo, content: content }))
                    .catch(error => {
                        console.warn(`Skipping local file ${relativePathInRepo}: ${error.message}`);
                        return { path: relativePathInRepo, content: null, error: true }; // Mark error
                    })
            );

            if (i % 150 === 0 || i === totalFiles - 1) {
                setStatus(`🔎 Analyzing local item ${i + 1}/${totalFiles}... (Filtered: ${ignoredFileCount})`, false, 'local');
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const filesToReadCount = fileProcessingPromises.length;
        setStatus(`📚 Reading ${filesToReadCount} filtered local files...`, false, 'local');
        await new Promise(resolve => setTimeout(resolve, 0));

        const results = await processPromisesBatch(fileProcessingPromises, 15, (done, total) => {
            setStatus(`📚 Reading local file ${done}/${total}...`, false, 'local');
        });

        let combinedOutput = '';
        results.forEach(result => {
            if (result && result.content !== null) {
                combinedOutput += `--- FILENAME: ${result.path} ---\n`;
                combinedOutput += result.content + '\n\n';
                processedFileCount++;
            } else if (result && result.error) {
                readErrorCount++;
            }
        });

        ignoredFileCount = totalFiles - processedFileCount - readErrorCount;
        outputArea.value = combinedOutput;
        setStatus(`✅ Done. Processed ${processedFileCount} files. Filtered/Ignored ${ignoredFileCount}. Read errors: ${readErrorCount}. Total: ${totalFiles}.`, false, 'final');
        copyButton.disabled = combinedOutput.length === 0;
        folderInput.value = null; // Allow selecting the same folder again
    }

    // Renamed original readFileContent for clarity
    function readFileContentLocal(file, sizeLimitOverride = null) {
        return new Promise((resolve, reject) => {
            const sizeLimit = sizeLimitOverride !== null ? sizeLimitOverride : currentMaxSizeBytes;
            if (file.size > sizeLimit) {
                return reject(new Error(`File size (${formatSize(file.size)}) exceeds limit (${formatSize(sizeLimit)})`));
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                if (text && text.indexOf('\u0000') !== -1) {
                    reject(new Error(`Detected null byte, likely binary: ${file.name}`));
                } else {
                    resolve(text);
                }
            };
            reader.onerror = (event) => reject(new Error(`Error reading file ${file.name}: ${reader.error}`));
            reader.readAsText(file);
        });
    }


    // --- Core Logic: Git URL ---

    function parseGitHubUrl(url) {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.hostname !== 'github.com') {
                return null;
            }
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean); // Filter empty strings
            if (pathParts.length < 2) {
                return null;
            }
            const [owner, repo] = pathParts;
            // Remove .git suffix if present
            const repoName = repo.endsWith('.git') ? repo.slice(0, -4) : repo;
            return { owner, repo: repoName };
        } catch (e) {
            console.error("URL parsing error:", e);
            return null; // Invalid URL format
        }
    }

    async function handleUrlFetch() {
        const repoUrl = urlInput.value.trim();
        if (!repoUrl) {
            setStatus('Please enter a GitHub repository URL.', true, 'url');
            return;
        }

        const repoInfo = parseGitHubUrl(repoUrl);
        if (!repoInfo) {
            setStatus('Invalid GitHub URL format. Use e.g., https://github.com/owner/repo', true, 'url');
            return;
        }

        setStatus('⏳ Preparing... Reading filters...', false, 'url');
        outputArea.value = 'Fetching repository data... Please wait.\n';
        copyButton.disabled = true;
        fetchUrlButton.disabled = true; // Disable button during fetch
        finalStatusDisplay.textContent = ''; // Clear final status
        gitignoreRules = [];
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
        currentFilterMode = filterModeSelect.value;

        let allFiles = []; // Array to hold { path: string, size: number, sha: string, type: 'file'|'dir', url: string }

        try {
            setStatus(`⏳ Fetching file list for ${repoInfo.owner}/${repoInfo.repo}... (May take time)`, false, 'url');
            allFiles = await fetchRepoContentsRecursive(repoInfo.owner, repoInfo.repo, '');

            const rootGitignore = allFiles.find(f => f.path === '.gitignore' && f.type === 'file');
            if (rootGitignore) {
                 try {
                    setStatus('⏳ Reading root .gitignore...', false, 'url');
                    const gitignoreContent = await fetchFileContentFromAPI(repoInfo.owner, repoInfo.repo, rootGitignore.path);
                    gitignoreRules = parseGitignore(gitignoreContent);
                    setStatus(`ℹ️ Found ${gitignoreRules.length} rules in .gitignore. Processing files...`, false, 'url');
                 } catch (error) {
                     console.error("Error fetching/reading repo .gitignore:", error);
                     // Don't treat as fatal, just warn
                     setStatus('⚠️ Could not read root .gitignore from repository.', true, 'url');
                 }
            } else {
                 setStatus('ℹ️ No root .gitignore found in repository. Processing files...', false, 'url');
            }
             await new Promise(resolve => setTimeout(resolve, 50));


            let processedFileCount = 0;
            let ignoredFileCount = 0;
            let readErrorCount = 0;
            let skippedApiLimitCount = 0;
            const totalItems = allFiles.length;
            const fileProcessingPromises = [];

            setStatus(`🔎 Analyzing ${totalItems} repository items...`, false, 'url');
            await new Promise(resolve => setTimeout(resolve, 0));

            for (let i = 0; i < allFiles.length; i++) {
                const item = allFiles[i];
                if (item.type !== 'file') {
                    // We only care about files for content processing
                    ignoredFileCount++;
                    continue;
                }

                 // Check GitHub API size limit *before* shouldProcessFile size check
                if (item.size > GITHUB_API_MAX_FILE_SIZE_BYTES) {
                    console.warn(`Skipping ${item.path}: Size (${formatSize(item.size)}) exceeds GitHub API content limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)}).`);
                    skippedApiLimitCount++;
                    ignoredFileCount++; // Also count as ignored
                    continue;
                }

                if (!shouldProcessFile(item.path, item.size, item.path.split('/').pop() /* filename */)) {
                    ignoredFileCount++;
                    continue;
                }

                // If it passes filters, add promise to fetch content
                fileProcessingPromises.push(
                    fetchFileContentFromAPI(repoInfo.owner, repoInfo.repo, item.path)
                        .then(content => ({ path: item.path, content: content }))
                        .catch(error => {
                            console.warn(`Skipping repo file ${item.path}: ${error.message}`);
                            return { path: item.path, content: null, error: true }; // Mark error
                        })
                );

                if (i % 50 === 0 || i === totalItems - 1) { // Update less frequently for API calls
                    setStatus(`🔎 Analyzing repository item ${i + 1}/${totalItems}... (Filtered: ${ignoredFileCount}, API Skip: ${skippedApiLimitCount})`, false, 'url');
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            const filesToReadCount = fileProcessingPromises.length;
            setStatus(`📚 Fetching content for ${filesToReadCount} filtered files via API... (Check console for rate limit warnings)`, false, 'url');
            await new Promise(resolve => setTimeout(resolve, 0));

            // Process API calls in smaller batches due to potential rate limits
            const results = await processPromisesBatch(fileProcessingPromises, 5, (done, total) => {
                 setStatus(`📚 Fetching file content ${done}/${total}...`, false, 'url');
            });

            let combinedOutput = '';
            results.forEach(result => {
                 if (result && result.content !== null) {
                     combinedOutput += `--- FILENAME: ${result.path} ---\n`;
                     combinedOutput += result.content + '\n\n';
                     processedFileCount++;
                 } else if (result && result.error) {
                    readErrorCount++;
                }
            });

            // Adjust ignored count calculation for API skips
            ignoredFileCount = totalItems - processedFileCount - readErrorCount; // totalItems includes dirs, adjust if needed

            outputArea.value = combinedOutput;
             const finalMessage = `✅ Done. Processed ${processedFileCount} files. Filtered/Ignored ${ignoredFileCount} items. Read errors: ${readErrorCount}. API Skips (>1MB): ${skippedApiLimitCount}. Total items listed: ${totalItems}.`;
            setStatus(finalMessage, false, 'final');
            copyButton.disabled = combinedOutput.length === 0;

        } catch (error) {
            console.error("Error fetching repository data:", error);
            setStatus(`❌ Error: ${error.message}. Check URL or GitHub API status/rate limits.`, true, 'final');
             outputArea.value = `Failed to process repository.\nError: ${error.message}`;
            copyButton.disabled = true;
        } finally {
             fetchUrlButton.disabled = false; // Re-enable button
        }
    }

    // Fetches repository contents recursively using GitHub API
    async function fetchRepoContentsRecursive(owner, repo, path = '', accumulatedFiles = []) {
        // Use default branch by not specifying ref, or add '?ref=branch-name' if needed
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const response = await fetch(apiUrl, {
            headers: { 'Accept': 'application/vnd.github.v3+json' } // Recommended header
        });

        if (!response.ok) {
            let errorMsg = `GitHub API error: ${response.status} ${response.statusText} for path "${path}".`;
            if (response.status === 404) errorMsg = `Repository or path not found: ${owner}/${repo}/${path}`;
            if (response.status === 403) {
                errorMsg = `GitHub API rate limit likely exceeded or private repository access denied. Wait a while or try later.`;
                console.warn('Rate limit headers:', {
                    limit: response.headers.get('X-RateLimit-Limit'),
                    remaining: response.headers.get('X-RateLimit-Remaining'),
                    reset: response.headers.get('X-RateLimit-Reset') ? new Date(response.headers.get('X-RateLimit-Reset') * 1000).toLocaleTimeString() : 'N/A'
                });
            }
            throw new Error(errorMsg);
        }

        const items = await response.json();
        const directoryPromises = [];

        for (const item of items) {
             // Store basic info for all items (needed for total count, filtering dirs later)
             accumulatedFiles.push({
                path: item.path,
                size: item.size,
                sha: item.sha,
                type: item.type, // 'file' or 'dir'
                url: item.url // API url for this item
             });

            if (item.type === 'dir') {
                // Recursively fetch subdirectory contents
                directoryPromises.push(fetchRepoContentsRecursive(owner, repo, item.path, accumulatedFiles));
            }
            // Files are added directly above, content fetched later if needed
        }

        // Wait for all recursive calls in this directory to complete
        await Promise.all(directoryPromises);

        // Return the accumulated list (only really needed at the top level call)
        return accumulatedFiles;
    }


    // Fetches a single file's content using GitHub API
    async function fetchFileContentFromAPI(owner, repo, filePath) {
        // Check against API limit before even fetching
        // Note: This check is also done in handleUrlFetch, but kept here for safety
        // const fileMetadata = /* need to find it in allFiles list or fetch metadata first */;
        // if (fileMetadata.size > GITHUB_API_MAX_FILE_SIZE_BYTES) {
        //    throw new Error(`File size (${formatSize(fileMetadata.size)}) exceeds GitHub API limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`);
        // }

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
        const response = await fetch(apiUrl, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });

        if (!response.ok) {
             let errorMsg = `GitHub API error fetching content: ${response.status} ${response.statusText} for "${filePath}".`;
             if (response.status === 403) {
                 errorMsg = `GitHub API rate limit likely exceeded or access denied for "${filePath}".`;
                 console.warn('Rate limit headers:', { /* ... same as above ... */ });
             }
             // If it's 404 here after listing, something is weird
             throw new Error(errorMsg);
        }

        const fileData = await response.json();

        if (fileData.size > GITHUB_API_MAX_FILE_SIZE_BYTES) {
             // This case should ideally be caught before calling this function based on listing size
            throw new Error(`File size (${formatSize(fileData.size)}) reported by content API exceeds limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`);
        }


        if (fileData.encoding !== 'base64') {
            // GitHub API usually uses base64 for files via this endpoint.
            // If content is included directly and not base64, or if encoding is different, handle it.
            // For simplicity, assume base64 or error for now.
             if(fileData.content){
                console.warn(`Unexpected encoding '${fileData.encoding}' for file ${filePath}. Attempting to use content directly.`);
                 return fileData.content; // Might work for UTF-8?
             } else {
                 throw new Error(`Unsupported encoding '${fileData.encoding || 'none'}' or missing content for file ${filePath}`);
             }
        }

        try {
            // Decode Base64 content
            const decodedContent = atob(fileData.content);
            // Check for null bytes after decoding (optional, but good for binary detection)
            if (decodedContent.indexOf('\u0000') !== -1) {
                 throw new Error(`Detected null byte after decoding, likely binary: ${filePath}`);
            }
            return decodedContent;
        } catch (e) {
            console.error("Base64 decoding error for:", filePath, e);
            throw new Error(`Failed to decode Base64 content for ${filePath}: ${e.message}`);
        }
    }


    // --- Utility Functions (Keep existing: parseUserPatterns, parseGitignore, shouldProcessFile, isLikelyBinaryByExtension, matchesSimplePattern, formatSize, copyOutputToClipboard, processPromisesBatch) ---

    function parseUserPatterns(patternsString) { /* ... no change ... */
        if (!patternsString) return [];
        return patternsString.split(',').map(p => p.trim()).filter(p => p);
    }

    function parseGitignore(content) { /* ... no change ... */
        if (!content) return [];
        return content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).filter(line => !line.startsWith('!'));
    }

     // Added apiFileSizeLimit parameter - important for URL mode
    function shouldProcessFile(relativePath, fileSize, fileName) {
        if (!relativePath) return false;

        // 1. Always Ignore (highest priority)
        for (const { pattern, isDir } of ALWAYS_IGNORE_PATTERNS) {
            if (matchesSimplePattern(relativePath, pattern, isDir)) return false;
        }

         // 2. GitHub API specific size limit (Applied *before* this function in URL mode, but good defense)
         // Note: This limit is checked *before* calling shouldProcessFile in URL mode now.
         // if (currentInputMode === 'url' && fileSize > GITHUB_API_MAX_FILE_SIZE_BYTES) {
         //    console.log(`Ignoring ${relativePath} - size ${formatSize(fileSize)} exceeds GitHub API limit ${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)}`);
         //    return false;
         // }

        // 3. User-defined size limit
        if (fileSize > currentMaxSizeBytes) return false;

        // 4. Binary Extension
        if (isLikelyBinaryByExtension(fileName)) return false;

        // 5. User Include/Exclude Patterns
        const matchesUserPattern = userFilterPatterns.length > 0 && userFilterPatterns.some(p => matchesSimplePattern(relativePath, p));
        if (currentFilterMode === 'Include') {
            if (userFilterPatterns.length > 0 && !matchesUserPattern) return false;
        } else { // Exclude mode
            if (matchesUserPattern) return false;
        }

        // 6. Gitignore Rules
        if (relativePath === '.gitignore') return true; // Always process root gitignore if found
        for (const rule of gitignoreRules) {
            if (matchesSimplePattern(relativePath, rule)) return false;
        }

        // 7. Process if not ignored
        return true;
    }


    function isLikelyBinaryByExtension(filename) { /* ... no change ... */
        const lowerFilename = filename.toLowerCase();
        const extension = '.' + lowerFilename.split('.').pop();
        return BINARY_EXTENSIONS.has(extension);
    }

    function matchesSimplePattern(path, pattern, isDirPattern = pattern.endsWith('/')) { /* ... (keep existing complex logic) ... */
        const normalizedPath = path.replace(/\\/g, '/');
        if (pattern.startsWith('!')) return false; // Ignore negation rules

        if (isDirPattern) {
            const dirPattern = pattern.slice(0, -1);
            return normalizedPath === dirPattern || normalizedPath.startsWith(dirPattern + '/');
        } else if (pattern.startsWith('**/')) {
             return normalizedPath.includes('/' + pattern.substring(3)) || normalizedPath.endsWith(pattern.substring(3));
        } else if (pattern.startsWith('*') && !pattern.includes('/')) {
            return normalizedPath.endsWith(pattern.slice(1));
        } else if (pattern.endsWith('*') && !pattern.includes('/')) {
             const filename = normalizedPath.split('/').pop();
             return filename.startsWith(pattern.slice(0, -1));
        } else if (!pattern.includes('*') && !pattern.includes('/')) {
             return normalizedPath.split('/').pop() === pattern;
        } else if (!pattern.includes('*') && pattern.includes('/')) {
             return normalizedPath === pattern || normalizedPath.startsWith(pattern + '/');
        }
        else {
            if (pattern.includes('*') && pattern.includes('/')) {
                 const regexPattern = pattern.replace(/\*/g, '[^/]*');
                 try {
                     const regex = new RegExp('^' + regexPattern + '$');
                     return regex.test(normalizedPath);
                 } catch (e) { console.warn("Regex pattern failed:", pattern, e); return false; }
            }
             if (pattern.includes('/')) { return normalizedPath.startsWith(pattern); }
        }
        return false;
    }

    function formatSize(bytes) { /* ... no change ... */
        if (bytes < 0) bytes = 0;
        if (bytes === 0) return '0 Bytes'; // Show 0 Bytes instead of 0 KB
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes < k) return bytes + ' Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        let size = parseFloat((bytes / Math.pow(k, i)).toFixed(i < 2 ? 0 : 1)); // 0 decimals for Bytes/KB, 1 for MB+

        if (size >= k && i < sizes.length - 1) {
             // Handle cases like 1024KB -> 1.0 MB
             size = parseFloat((bytes / Math.pow(k, i + 1)).toFixed(1));
             return `${size} ${sizes[i + 1]}`;
         }

        return `${size} ${sizes[i]}`;
    }

     async function processPromisesBatch(promises, batchSize, progressCallback) { /* ... no change ... */
        let results = [];
        let index = 0;
        while (index < promises.length) {
            const batch = promises.slice(index, index + batchSize);
            const batchResults = await Promise.all(batch);
            results = results.concat(batchResults);
            index += batchSize;
            if (progressCallback) {
                progressCallback(Math.min(index, promises.length), promises.length);
            }
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        return results;
    }


    function copyOutputToClipboard() { /* ... (keep existing logic with fallback) ... */
        if (!outputArea.value) return;
        navigator.clipboard.writeText(outputArea.value)
            .then(() => {
                const originalStatus = finalStatusDisplay.textContent; // Use final status now
                setStatus('✅ Output copied to clipboard!', false, 'final');
                const originalButtonText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                copyButton.classList.add('copied');

                setTimeout(() => {
                    copyButton.textContent = originalButtonText;
                    copyButton.classList.remove('copied');
                    if (finalStatusDisplay.textContent === '✅ Output copied to clipboard!') {
                         finalStatusDisplay.textContent = originalStatus; // Restore original *final* status
                    }
                }, 2500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                setStatus('❌ Failed to copy. See console for error.', true, 'final');
                try { /* ... fallback ... */
                    outputArea.select(); document.execCommand('copy');
                    const originalStatus = finalStatusDisplay.textContent;
                    setStatus('✅ Copied using fallback method.', false, 'final');
                    /* ... button feedback ... */
                     setTimeout(() => { /* restore button, restore status */
                         if (finalStatusDisplay.textContent === '✅ Copied using fallback method.') finalStatusDisplay.textContent = originalStatus;
                    }, 2500);
                } catch (execErr) {
                     console.error('Fallback copy method failed:', execErr);
                     alert('Could not copy text automatically. Please select the text and copy manually (Ctrl+C or Cmd+C).');
                     setStatus('❌ Automatic copy failed. Please copy manually.', true, 'final');
                }
                window.getSelection().removeAllRanges();
            });
    }


}); // End DOMContentLoaded