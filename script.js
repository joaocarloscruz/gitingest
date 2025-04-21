document.addEventListener('DOMContentLoaded', () => {
    // Check for JSZip
    if (typeof JSZip === 'undefined') {
        console.error("JSZip library not loaded! Download functionality will be disabled.");
        alert("Error: JSZip library failed to load. Download functionality will not work.");
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
    const filterModeSelect = document.getElementById('filterMode');
    const filterPatternsInput = document.getElementById('filterPatterns');
    const maxSizeSlider = document.getElementById('maxSizeSlider');
    const maxSizeValueDisplay = document.getElementById('maxSizeValue');
    const downloadZipButton = document.getElementById('downloadZipButton');
    const downloadStatusDisplay = document.getElementById('downloadStatus');
    const finalStatusDisplay = document.getElementById('finalStatus');
    const finalStatusCard = document.getElementById('finalStatusCard');
    const fileTreeContainer = document.getElementById('fileTree');
    const filePreviewContainer = document.getElementById('filePreview');
    const fileContentPreview = document.getElementById('fileContentPreview');
    const previewPlaceholder = document.getElementById('previewPlaceholder');
    const previewFileNameDisplay = document.getElementById('previewFileName');
    const copyPreviewButton = document.getElementById('copyPreviewButton');


    // --- State Variables ---
    let currentMaxSizeBytes = parseInt(maxSizeSlider.value) * 1024;
    let currentInputMode = 'local'; // 'local' or 'url'
    let gitignoreRules = [];
    let userFilterPatterns = [];
    let currentFilterMode = filterModeSelect.value;
    let processedFilesData = []; // Stores { path: string, content: string, size: number }
    let currentRepoName = 'codebase'; // Default name for zip file

    // GitHub API limits content fetching via contents endpoint to 1MB
    const GITHUB_API_MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

    const BINARY_EXTENSIONS = new Set([
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
        '.lock', '.lockb', /*'.package-lock.json',*/ // Usually text, keep it processable
        // Assets/Fonts
        /* '.svg', */ '.woff', '.woff2', '.ttf', '.otf', '.eot', // SVG is text
        // Database files
        '.sqlite', '.db', '.mdb',
        // Others
        '.DS_Store', 'Thumbs.db'
    ]);

    const ALWAYS_IGNORE_PATTERNS = [
        '.git/', '.svn/', '.hg/', 'node_modules/', 'bower_components/', 'vendor/',
        'dist/', 'build/', 'out/', 'target/', 'coverage/', '__pycache__/', '*.pyc',
        '.DS_Store', 'Thumbs.db', '.env', '.idea/', '.vscode/', '*.log', '*.tmp', '*.temp',
        'package-lock.json', 'yarn.lock' // Often huge and less useful for LLM context
    ].map(p => ({ pattern: p, isDir: p.endsWith('/') }));


    // --- Event Listeners ---
    modeLocalRadio.addEventListener('change', handleModeChange);
    modeUrlRadio.addEventListener('change', handleModeChange);
    folderInput.addEventListener('change', handleFolderSelect);
    fetchUrlButton.addEventListener('click', handleUrlFetch);
    maxSizeSlider.addEventListener('input', updateMaxSize);
    filterModeSelect.addEventListener('change', () => { currentFilterMode = filterModeSelect.value; });
    filterPatternsInput.addEventListener('input', () => { // Update user patterns dynamically (but only applied on process)
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
    });
    downloadZipButton.addEventListener('click', handleDownloadZip);
    copyPreviewButton.addEventListener('click', copyPreviewContent);

    // --- Initial Setup ---
    handleModeChange();
    updateMaxSize();
    resetUIState(); // Ensure clean initial state

    // --- UI State Management ---

    function resetUIState(clearInputs = false) {
        fileTreeContainer.innerHTML = '<p class="placeholder">Process a folder or URL to view the structure here.</p>';
        fileContentPreview.textContent = '';
        previewPlaceholder.style.display = 'block';
        filePreviewContainer.style.display = 'none'; // Hide preview area initially
        previewFileNameDisplay.textContent = 'No file selected';
        processedFilesData = [];
        downloadZipButton.disabled = true;
        copyPreviewButton.disabled = true;
        downloadStatusDisplay.textContent = '';
        finalStatusDisplay.textContent = '';
        finalStatusCard.style.display = 'none';
        finalStatusCard.className = 'card'; // Reset status card style

        if (clearInputs) {
            folderInput.value = null;
            urlInput.value = '';
            localStatusDisplay.textContent = 'No folder selected.';
            urlStatusDisplay.textContent = 'Enter a public GitHub repository URL.';
        }
    }

    function handleModeChange() {
        currentInputMode = document.querySelector('input[name="inputMode"]:checked').value;
        resetUIState(true); // Clear everything when mode changes

        if (currentInputMode === 'local') {
            localModeSection.style.display = 'block';
            urlModeSection.style.display = 'none';
        } else { // url mode
            localModeSection.style.display = 'none';
            urlModeSection.style.display = 'block';
        }
    }

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

    // More granular status updates
    function setStatus(message, type = 'info', target = 'final') {
        // target: 'local', 'url', 'download', 'final'
        let displayElement;
        let isError = (type === 'error');
        let isWarning = (type === 'warning');
        let isSuccess = (type === 'success');

        switch (target) {
            case 'local': displayElement = localStatusDisplay; break;
            case 'url': displayElement = urlStatusDisplay; break;
            case 'download': displayElement = downloadStatusDisplay; break;
            case 'final': displayElement = finalStatusDisplay; break;
            default: displayElement = finalStatusDisplay;
        }

        if (displayElement) {
            displayElement.textContent = message;
            let color = 'var(--color-secondary)'; // Default info color
            if (isError) color = 'var(--color-danger)';
            else if (isWarning) color = 'var(--color-warning)';
            else if (isSuccess) color = 'var(--color-success)';
            displayElement.style.color = color;

            // Special handling for final status card
            if (target === 'final') {
                 finalStatusCard.style.display = message ? 'block' : 'none';
                 finalStatusCard.className = 'card'; // Reset classes
                 if (isError) finalStatusCard.classList.add('status-error');
                 else if (isWarning) finalStatusCard.classList.add('status-warning');
                 else if (isSuccess) finalStatusCard.classList.add('status-success');
                 else finalStatusCard.classList.add('status-info');
            }
        }

        if (message) { // Log non-empty messages
             if (isError) console.error(message);
             else if (isWarning) console.warn(message);
             else console.log(message);
        }
    }

    // --- Core Logic: Local Folder ---
    async function handleFolderSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            setStatus('No folder selected or folder is empty.', 'warning', 'local');
            resetUIState();
            return;
        }

        resetUIState(); // Clear previous results
        setStatus('⏳ Preparing... Reading filters...', 'info', 'local');
        setUIDisabled(true); // Disable UI during processing

        // Extract folder name for zip file
        const firstFilePath = files[0]?.webkitRelativePath;
        currentRepoName = firstFilePath ? firstFilePath.split('/')[0] : 'local_codebase';


        gitignoreRules = [];
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
        currentFilterMode = filterModeSelect.value;

        const sortedFiles = Array.from(files).sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath));

        // Read root .gitignore first
        const rootGitignoreFile = sortedFiles.find(f => f.webkitRelativePath === `${currentRepoName}/.gitignore`);
        if (rootGitignoreFile) {
            try {
                setStatus('⏳ Reading root .gitignore...', 'info', 'local');
                const gitignoreContent = await readFileContentLocal(rootGitignoreFile, 1 * 1024 * 1024);
                gitignoreRules = parseGitignore(gitignoreContent);
                setStatus(`ℹ️ Found ${gitignoreRules.length} rules in .gitignore.`, 'info', 'local');
            } catch (error) {
                console.error("Error reading local .gitignore:", error);
                setStatus('⚠️ Could not read root .gitignore, proceeding without it.', 'warning', 'local');
            }
        } else {
            setStatus('ℹ️ No root .gitignore found.', 'info', 'local');
        }
         await new Promise(resolve => setTimeout(resolve, 20)); // Allow UI update

        let ignoredFileCount = 0;
        let readErrorCount = 0;
        const totalFiles = sortedFiles.length;
        const fileProcessingPromises = [];
        processedFilesData = []; // Reset data

        setStatus(`🔎 Analyzing ${totalFiles} local items...`, 'info', 'local');
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI update

        for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            if (!file.webkitRelativePath) { ignoredFileCount++; continue; }

            // Get path relative to the selected root folder
            const firstSlashIndex = file.webkitRelativePath.indexOf('/');
            const relativePathInRepo = firstSlashIndex !== -1 ? file.webkitRelativePath.substring(firstSlashIndex + 1) : file.webkitRelativePath;

            // Skip empty paths or the root folder entry itself if it appears
            if (!relativePathInRepo) { ignoredFileCount++; continue; }


            if (!shouldProcessFile(relativePathInRepo, file.size, file.name)) {
                ignoredFileCount++;
                continue;
            }

            fileProcessingPromises.push(
                readFileContentLocal(file)
                    .then(content => ({ path: relativePathInRepo, content: content, size: file.size }))
                    .catch(error => {
                        console.warn(`Skipping local file ${relativePathInRepo}: ${error.message}`);
                        return { path: relativePathInRepo, content: null, error: true, size: file.size }; // Mark error
                    })
            );

            if (i % 150 === 0 || i === totalFiles - 1) {
                setStatus(`🔎 Analyzing local item ${i + 1}/${totalFiles}... (Filtered: ${ignoredFileCount})`, 'info', 'local');
                await new Promise(resolve => setTimeout(resolve, 0)); // Prevent blocking UI thread
            }
        }

        const filesToReadCount = fileProcessingPromises.length;
        setStatus(`📚 Reading ${filesToReadCount} filtered local files...`, 'info', 'local');
        await new Promise(resolve => setTimeout(resolve, 0)); // UI update

        const results = await processPromisesBatch(fileProcessingPromises, 15, (done, total) => {
            setStatus(`📚 Reading local file ${done}/${total}...`, 'info', 'local');
        });

        let processedFileCount = 0;
        results.forEach(result => {
            if (result && result.content !== null) {
                processedFilesData.push({ path: result.path, content: result.content, size: result.size });
                processedFileCount++;
            } else if (result && result.error) {
                readErrorCount++;
            }
        });

        ignoredFileCount = totalFiles - processedFileCount - readErrorCount;

        // Render results
        renderFileTreeFromData(processedFilesData);

        setStatus(`✅ Done. Processed ${processedFileCount} files. Filtered/Ignored ${ignoredFileCount}. Read errors: ${readErrorCount}. Total items: ${totalFiles}.`, 'success', 'final');
        folderInput.value = null; // Allow selecting the same folder again
        setUIDisabled(false); // Re-enable UI
        downloadZipButton.disabled = processedFilesData.length === 0 || typeof JSZip === 'undefined';
    }

    function readFileContentLocal(file, sizeLimitOverride = null) {
        return new Promise((resolve, reject) => {
            const sizeLimit = sizeLimitOverride !== null ? sizeLimitOverride : currentMaxSizeBytes;
            if (file.size > sizeLimit) {
                return reject(new Error(`Size (${formatSize(file.size)}) exceeds limit (${formatSize(sizeLimit)})`));
            }
            if (file.size === 0) { // Handle empty files explicitly
                 resolve("");
                 return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                // Basic check for binary - look for null bytes
                if (text && text.indexOf('\u0000') !== -1) {
                    reject(new Error(`Detected null byte, likely binary: ${file.name}`));
                } else {
                    resolve(text);
                }
            };
            reader.onerror = (event) => reject(new Error(`Error reading file ${file.name}: ${reader.error}`));
            reader.readAsText(file); // Assume text, check for null byte later
        });
    }


    // --- Core Logic: Git URL ---

    function parseGitHubUrl(url) {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.hostname !== 'github.com') return null;
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            if (pathParts.length < 2) return null;
            const [owner, repo] = pathParts;
            const repoName = repo.endsWith('.git') ? repo.slice(0, -4) : repo;
            return { owner, repo: repoName };
        } catch (e) { return null; }
    }

    async function handleUrlFetch() {
        const repoUrl = urlInput.value.trim();
        if (!repoUrl) {
            setStatus('Please enter a GitHub repository URL.', 'warning', 'url');
            return;
        }

        const repoInfo = parseGitHubUrl(repoUrl);
        if (!repoInfo) {
            setStatus('Invalid GitHub URL format. Use e.g., https://github.com/owner/repo', 'error', 'url');
            return;
        }

        resetUIState(); // Clear previous results
        setStatus('⏳ Preparing... Reading filters...', 'info', 'url');
        setUIDisabled(true); // Disable UI

        currentRepoName = repoInfo.repo; // Set repo name for zip file
        gitignoreRules = [];
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
        currentFilterMode = filterModeSelect.value;
        processedFilesData = []; // Reset data

        let allFilesMeta = []; // Stores { path: string, size: number, sha: string, type: 'file'|'dir', url: string }

        try {
            setStatus(`⏳ Fetching file list for ${repoInfo.owner}/${repoInfo.repo}... (May take time)`, 'info', 'url');
            allFilesMeta = await fetchRepoContentsRecursive(repoInfo.owner, repoInfo.repo, '');

            const rootGitignoreMeta = allFilesMeta.find(f => f.path === '.gitignore' && f.type === 'file');
            if (rootGitignoreMeta) {
                 try {
                    setStatus('⏳ Reading root .gitignore...', 'info', 'url');
                    const gitignoreContent = await fetchFileContentFromAPI(repoInfo.owner, repoInfo.repo, rootGitignoreMeta.path, rootGitignoreMeta.size);
                    gitignoreRules = parseGitignore(gitignoreContent);
                    setStatus(`ℹ️ Found ${gitignoreRules.length} rules in .gitignore.`, 'info', 'url');
                 } catch (error) {
                     console.error("Error fetching/reading repo .gitignore:", error);
                     setStatus(`⚠️ Could not read root .gitignore: ${error.message}.`, 'warning', 'url');
                 }
            } else {
                 setStatus('ℹ️ No root .gitignore found in repository.', 'info', 'url');
            }
             await new Promise(resolve => setTimeout(resolve, 50)); // UI update


            let ignoredItemCount = 0;
            let readErrorCount = 0;
            let skippedApiLimitCount = 0;
            const totalItems = allFilesMeta.length;
            const fileProcessingPromises = [];

            setStatus(`🔎 Analyzing ${totalItems} repository items...`, 'info', 'url');
            await new Promise(resolve => setTimeout(resolve, 0)); // UI update

            for (let i = 0; i < allFilesMeta.length; i++) {
                const item = allFilesMeta[i];
                if (item.type !== 'file') {
                    ignoredItemCount++;
                    continue;
                }

                 // Check GitHub API size limit *before* filtering rules
                if (item.size > GITHUB_API_MAX_FILE_SIZE_BYTES) {
                    console.warn(`Skipping ${item.path}: Size (${formatSize(item.size)}) exceeds GitHub API content limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)}).`);
                    skippedApiLimitCount++;
                    ignoredItemCount++; // Count as ignored
                    continue;
                }

                const fileName = item.path.split('/').pop();
                if (!shouldProcessFile(item.path, item.size, fileName)) {
                    ignoredItemCount++;
                    continue;
                }

                // If it passes filters, add promise to fetch content
                fileProcessingPromises.push(
                    fetchFileContentFromAPI(repoInfo.owner, repoInfo.repo, item.path, item.size)
                        .then(content => ({ path: item.path, content: content, size: item.size }))
                        .catch(error => {
                            console.warn(`Skipping repo file ${item.path}: ${error.message}`);
                            return { path: item.path, content: null, error: true, size: item.size }; // Mark error
                        })
                );

                if (i % 50 === 0 || i === totalItems - 1) {
                    setStatus(`🔎 Analyzing repository item ${i + 1}/${totalItems}... (Filtered: ${ignoredItemCount}, API Skip: ${skippedApiLimitCount})`, 'info', 'url');
                    await new Promise(resolve => setTimeout(resolve, 0)); // UI update
                }
            }

            const filesToReadCount = fileProcessingPromises.length;
            setStatus(`📚 Fetching content for ${filesToReadCount} filtered files via API...`, 'info', 'url');
            await new Promise(resolve => setTimeout(resolve, 0)); // UI update

            // Process API calls in smaller batches due to potential rate limits
            const results = await processPromisesBatch(fileProcessingPromises, 5, (done, total) => {
                 setStatus(`📚 Fetching file content ${done}/${total}...`, 'info', 'url');
            });

            let processedFileCount = 0;
            results.forEach(result => {
                 if (result && result.content !== null) {
                     processedFilesData.push({ path: result.path, content: result.content, size: result.size });
                     processedFileCount++;
                 } else if (result && result.error) {
                    readErrorCount++;
                }
            });

            // Adjust ignored count (total items includes directories)
            const processedDirs = allFilesMeta.filter(item => item.type === 'dir').length;
            ignoredItemCount = totalItems - processedFileCount - readErrorCount - processedDirs;

            renderFileTreeFromData(processedFilesData);

            const finalMessage = `✅ Done. Processed ${processedFileCount} files. Filtered/Ignored ${ignoredItemCount} items. Read errors: ${readErrorCount}. API Skips (>1MB): ${skippedApiLimitCount}. Total items listed: ${totalItems}.`;
            setStatus(finalMessage, 'success', 'final');

        } catch (error) {
            console.error("Error fetching repository data:", error);
            setStatus(`❌ Error: ${error.message}. Check URL or GitHub API status/rate limits.`, 'error', 'final');
             renderFileTreeFromData([]); // Show empty tree on error
        } finally {
             setUIDisabled(false); // Re-enable UI
             downloadZipButton.disabled = processedFilesData.length === 0 || typeof JSZip === 'undefined';
        }
    }

    async function fetchRepoContentsRecursive(owner, repo, path = '', accumulatedFiles = []) {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const response = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } });

        if (!response.ok) {
            let errorMsg = `GitHub API Error (${response.status}) for path "/${path}".`;
            try { // Try to get more specific error message from GitHub API response body
                 const errorData = await response.json();
                 errorMsg = `GitHub API Error: ${errorData.message || response.statusText} (for path "/${path}")`;
            } catch (e) { /* Ignore json parsing error */ }

            if (response.status === 404) errorMsg = `Repository or path not found: ${owner}/${repo}/${path}`;
            if (response.status === 403) {
                const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
                 if (rateLimitRemaining && parseInt(rateLimitRemaining) === 0) {
                     const resetTime = new Date(parseInt(response.headers.get('X-RateLimit-Reset')) * 1000);
                     errorMsg = `GitHub API rate limit exceeded. Try again after ${resetTime.toLocaleTimeString()}.`;
                 } else {
                     errorMsg = `Access denied for ${owner}/${repo}/${path}. Is it a private repository?`;
                 }
                console.warn('Rate limit headers:', { /* ... */ });
            }
            throw new Error(errorMsg);
        }

        const items = await response.json();
        if (!Array.isArray(items)) { // Can happen for single file paths
            if (items.type === 'file' || items.type === 'dir') {
                 accumulatedFiles.push({ path: items.path, size: items.size, sha: items.sha, type: items.type, url: items.url });
                 if (items.type === 'dir') {
                     // Need to fetch contents of this single directory
                     await fetchRepoContentsRecursive(owner, repo, items.path, accumulatedFiles);
                 }
                 return accumulatedFiles; // Return early if it was a single item response
            } else {
                throw new Error(`Unexpected API response format for path "${path}".`);
            }
        }

        const directoryPromises = [];
        for (const item of items) {
             accumulatedFiles.push({ path: item.path, size: item.size, sha: item.sha, type: item.type, url: item.url });
            if (item.type === 'dir') {
                directoryPromises.push(fetchRepoContentsRecursive(owner, repo, item.path, accumulatedFiles));
            }
        }
        await Promise.all(directoryPromises);
        return accumulatedFiles;
    }


    // Fetches a single file's content using GitHub API
    async function fetchFileContentFromAPI(owner, repo, filePath, fileSize) {
         // Double-check size limit before fetching content
         if (fileSize > GITHUB_API_MAX_FILE_SIZE_BYTES) {
             throw new Error(`File size (${formatSize(fileSize)}) exceeds GitHub API limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`);
         }
         if (fileSize === 0) return ""; // Handle empty files

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
        const response = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3.raw' } }); // Use 'raw' media type for potentially direct content

        if (!response.ok) {
             let errorMsg = `GitHub API content fetch error (${response.status}) for "${filePath}".`;
             if (response.status === 403) { /* ... rate limit/access denied check ... */
                 errorMsg = `Access denied or rate limit exceeded fetching content for "${filePath}".`;
             }
             // Try fetching JSON to see if it's base64 encoded (fallback)
              try {
                 const jsonResponse = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
                 if (jsonResponse.ok) {
                     const fileData = await jsonResponse.json();
                     if (fileData.encoding === 'base64' && fileData.content) {
                         console.warn(`File "${filePath}" was fetched as base64 (potentially large).`);
                          if (fileData.size > GITHUB_API_MAX_FILE_SIZE_BYTES) { // Check size again from JSON response
                            throw new Error(`File size (${formatSize(fileData.size)}) reported by JSON API exceeds limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`);
                          }
                         try {
                             const decodedContent = atob(fileData.content);
                             if (decodedContent.indexOf('\u0000') !== -1) {
                                 throw new Error(`Detected null byte after decoding base64, likely binary: ${filePath}`);
                             }
                             return decodedContent;
                         } catch (e) {
                             throw new Error(`Failed to decode Base64 content for ${filePath}: ${e.message}`);
                         }
                     }
                 }
              } catch (e) { /* ignore fallback error */ }

             throw new Error(errorMsg); // Throw original error if fallback fails
        }

        // If 'raw' response is OK, get the text content directly
        const content = await response.text();
         // Basic check for binary - look for null bytes
         if (content && content.indexOf('\u0000') !== -1) {
             throw new Error(`Detected null byte in raw content, likely binary: ${filePath}`);
         }
        return content;
    }

    // --- File Tree Rendering ---

    function buildFileTreeData(files) {
        const tree = {};

        files.forEach(file => {
            const pathParts = file.path.split('/');
            let currentLevel = tree;

            pathParts.forEach((part, index) => {
                if (!part) return; // Should not happen with cleaned paths

                if (index === pathParts.length - 1) {
                    // It's a file
                    currentLevel[part] = {
                        type: 'file',
                        path: file.path,
                        size: file.size
                        // Content is retrieved separately when clicked
                    };
                } else {
                    // It's a directory
                    if (!currentLevel[part]) {
                        currentLevel[part] = { type: 'dir', children: {} };
                    }
                    // Ensure we are referencing the children object for the next level
                    if(currentLevel[part].type !== 'dir') {
                        // This case should ideally not happen if paths are consistent
                        // But as a safeguard, overwrite if a file name conflicts with a dir name
                        console.warn(`Path conflict: "${part}" exists as both file and directory.`);
                        currentLevel[part] = { type: 'dir', children: {} };
                    }
                    currentLevel = currentLevel[part].children;
                }
            });
        });
        return tree;
    }

     function renderFileTreeFromData(files) {
        if (!files || files.length === 0) {
            fileTreeContainer.innerHTML = '<p class="placeholder">No processable files found matching the criteria.</p>';
            resetPreview();
            return;
        }

        const treeData = buildFileTreeData(files);
        const treeElement = document.createElement('ul');
        renderTreeNodes(treeData, treeElement);

        fileTreeContainer.innerHTML = ''; // Clear previous tree/placeholder
        fileTreeContainer.appendChild(treeElement);
        resetPreview(); // Clear preview when tree is rebuilt
    }

     function renderTreeNodes(nodes, parentElement) {
        Object.keys(nodes).sort().forEach(name => { // Sort alphabetically
            const node = nodes[name];
            const li = document.createElement('li');

            if (node.type === 'dir') {
                li.classList.add('folder');
                li.innerHTML = `<span class="icon">📁</span><span>${name}</span>`;
                const ul = document.createElement('ul');
                renderTreeNodes(node.children, ul);
                if (ul.hasChildNodes()) {
                    li.appendChild(ul);
                }
            } else if (node.type === 'file') {
                li.classList.add('file');
                const span = document.createElement('span');
                span.innerHTML = `<span class="icon">📄</span><span>${name} (${formatSize(node.size)})</span>`;
                span.dataset.filePath = node.path; // Store full path for retrieval
                span.addEventListener('click', handleFileClick);
                li.appendChild(span);
            }
            parentElement.appendChild(li);
        });
    }

    function handleFileClick(event) {
        const targetSpan = event.currentTarget;
        const filePath = targetSpan.dataset.filePath;
        const fileData = processedFilesData.find(f => f.path === filePath);

        // Remove selection from previously selected item
        const previouslySelected = fileTreeContainer.querySelector('.file.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }

        // Add selection to clicked item
        if (targetSpan.parentElement.classList.contains('file')) {
             targetSpan.parentElement.classList.add('selected');
        }


        if (fileData) {
            previewFileNameDisplay.textContent = filePath;
            fileContentPreview.textContent = fileData.content;
            previewPlaceholder.style.display = 'none';
            filePreviewContainer.style.display = 'flex'; // Show preview area
             copyPreviewButton.disabled = false;
             // Optional: Add syntax highlighting class if library were included
             // fileContentPreview.className = `language-${getFileExtension(filePath)}`;
             // Prism.highlightElement(fileContentPreview); // If using Prism.js
        } else {
            resetPreview();
            setStatus(`Could not find content for ${filePath}`, 'error', 'final');
        }
    }

    function resetPreview() {
         previewFileNameDisplay.textContent = 'No file selected';
         fileContentPreview.textContent = '';
         previewPlaceholder.style.display = 'block';
         filePreviewContainer.style.display = 'flex'; // Keep container visible, but show placeholder
         copyPreviewButton.disabled = true;
          // Clear selection highlight in tree
         const previouslySelected = fileTreeContainer.querySelector('.file.selected');
         if (previouslySelected) {
             previouslySelected.classList.remove('selected');
         }
    }

    function copyPreviewContent() {
         if (!fileContentPreview.textContent) return;
        navigator.clipboard.writeText(fileContentPreview.textContent)
            .then(() => {
                 const originalButtonText = copyPreviewButton.textContent;
                 copyPreviewButton.textContent = 'Copied!';
                 copyPreviewButton.classList.add('copied');
                setTimeout(() => {
                    copyPreviewButton.textContent = originalButtonText;
                    copyPreviewButton.classList.remove('copied');
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy preview content: ', err);
                alert('Failed to copy content to clipboard. Check browser permissions or copy manually.');
            });
    }

    // --- Download Functionality ---

    async function handleDownloadZip() {
         if (typeof JSZip === 'undefined') {
             setStatus('JSZip library not loaded, cannot create zip.', 'error', 'download');
             return;
         }
        if (!processedFilesData || processedFilesData.length === 0) {
            setStatus('No files processed to download.', 'warning', 'download');
            return;
        }

        setStatus('⏳ Creating zip archive...', 'info', 'download');
        downloadZipButton.disabled = true;
        const zip = new JSZip();

        try {
            processedFilesData.forEach(file => {
                // Add file to zip, creating directories automatically
                zip.file(file.path, file.content);
            });

            setStatus('📦 Generating zip blob...', 'info', 'download');
             // Generate zip file content asynchronously
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 6 } // Balance between speed and size
            }, (metadata) => {
                 // Optional progress update
                 setStatus(`📦 Compressing... ${metadata.percent.toFixed(0)}%`, 'info', 'download');
            });

            setStatus('⬇️ Triggering download...', 'info', 'download');

            // Create a temporary link to trigger the download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `${currentRepoName}.zip`; // Use repo/folder name
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href); // Clean up blob URL

            setStatus(`✅ Zip file '${currentRepoName}.zip' generated.`, 'success', 'download');

        } catch (error) {
            console.error("Error creating zip file:", error);
            setStatus(`❌ Error creating zip: ${error.message}`, 'error', 'download');
        } finally {
            // Re-enable button after a short delay unless an error occurred immediately
            setTimeout(() => {
                 downloadZipButton.disabled = processedFilesData.length === 0 || typeof JSZip === 'undefined';
                 // Optionally clear download status after success
                 // if (!downloadStatusDisplay.textContent.startsWith('❌')) {
                 //    setTimeout(() => setStatus('', 'info', 'download'), 3000);
                 // }
            }, 1500);
        }
    }

    // --- Utility Functions ---

    function setUIDisabled(isDisabled) {
        modeLocalRadio.disabled = isDisabled;
        modeUrlRadio.disabled = isDisabled;
        folderInput.disabled = isDisabled; // Although hidden, good practice
        document.querySelector('label[for="folderInput"]').style.pointerEvents = isDisabled ? 'none' : '';
        document.querySelector('label[for="folderInput"]').style.opacity = isDisabled ? '0.65' : '1';
        urlInput.disabled = isDisabled;
        fetchUrlButton.disabled = isDisabled;
        filterModeSelect.disabled = isDisabled;
        filterPatternsInput.disabled = isDisabled;
        maxSizeSlider.disabled = isDisabled;
        // Keep download/copy buttons disabled based on their own logic, but re-evaluate at the end
    }

    function parseUserPatterns(patternsString) {
        if (!patternsString) return [];
        return patternsString.split(',').map(p => p.trim()).filter(p => p);
    }

    function parseGitignore(content) {
        if (!content) return [];
        // Filter empty lines, comments, and keep negation rules for potential future use (though currently ignored by matchesSimplePattern)
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
            // .filter(line => !line.startsWith('!')); // Keep negation rules if needed later
    }

    function shouldProcessFile(relativePath, fileSize, fileName) {
        if (!relativePath || relativePath === '.git') return false; // Basic sanity check

        // 1. Always Ignore (highest priority)
        for (const { pattern, isDir } of ALWAYS_IGNORE_PATTERNS) {
            if (matchesSimplePattern(relativePath, pattern, isDir)) {
                 // console.log(`Ignoring ${relativePath} due to ALWAYS_IGNORE pattern: ${pattern}`);
                return false;
            }
        }

        // 2. User-defined size limit (checked *before* API calls for URL mode where applicable)
        if (fileSize > currentMaxSizeBytes) {
             // console.log(`Ignoring ${relativePath} - size ${formatSize(fileSize)} exceeds limit ${formatSize(currentMaxSizeBytes)}`);
            return false;
        }
         // 3. Binary Extension Check (Before user filters, common case)
         if (isLikelyBinaryByExtension(fileName)) {
             // console.log(`Ignoring ${relativePath} due to likely binary extension.`);
             return false;
         }


        // 4. User Include/Exclude Patterns
        const userPatterns = parseUserPatterns(filterPatternsInput.value); // Get fresh patterns
        const filterMode = filterModeSelect.value;
        let matchesUserPattern = false;
        if (userPatterns.length > 0) {
            matchesUserPattern = userPatterns.some(p => matchesSimplePattern(relativePath, p));
        }

        if (filterMode === 'Include') {
            // If include list exists, MUST match one pattern
            if (userPatterns.length > 0 && !matchesUserPattern) {
                // console.log(`Ignoring ${relativePath} - does not match INCLUDE patterns.`);
                return false;
            }
            // If include list is empty, include everything (unless excluded by other rules)
        } else { // Exclude mode (default)
            // If exclude list exists AND it matches a pattern, ignore it
            if (userPatterns.length > 0 && matchesUserPattern) {
                 // console.log(`Ignoring ${relativePath} due to EXCLUDE pattern match.`);
                return false;
            }
             // If exclude list is empty, or it doesn't match, continue processing (unless excluded by gitignore)
        }


        // 5. Gitignore Rules (applied last among filters)
        // Allow processing .gitignore itself if filters above didn't exclude it
        if (relativePath.endsWith('/.gitignore')) return true;

        for (const rule of gitignoreRules) {
            // Ignore comments and empty lines again just in case
             const trimmedRule = rule.trim();
             if (!trimmedRule || trimmedRule.startsWith('#')) continue;

             // Handle negation rules - If a non-negated rule matches later, it still gets ignored.
             // Proper handling needs more complex logic (last matching rule wins).
             // For simplicity, we ignore negations for now.
             if (trimmedRule.startsWith('!')) continue;


            if (matchesSimplePattern(relativePath, trimmedRule)) {
                // console.log(`Ignoring ${relativePath} due to gitignore rule: ${rule}`);
                return false;
            }
        }

        // 6. Process if not ignored by any rule
        return true;
    }

    function isLikelyBinaryByExtension(filename) {
        if (!filename) return false;
        const lowerFilename = filename.toLowerCase();
        // Handle files with no extension or starting with '.' (.bashrc)
        const lastDotIndex = lowerFilename.lastIndexOf('.');
        if (lastDotIndex < 1 || lastDotIndex === lowerFilename.length - 1) {
             // No extension or ends with dot, assume text unless known binary name
             return BINARY_EXTENSIONS.has(lowerFilename); // Check if the whole name is in the list
        }
        const extension = lowerFilename.substring(lastDotIndex);
        return BINARY_EXTENSIONS.has(extension);
    }


    // Simplified glob-like matching for common .gitignore patterns
    function matchesSimplePattern(path, pattern, isDirPattern = pattern.endsWith('/')) {
        const normalizedPath = path.replace(/\\/g, '/'); // Ensure forward slashes
        pattern = pattern.trim();

        // Handle directory pattern explicitly
        if (isDirPattern) {
            const dirPattern = pattern.slice(0, -1);
            // Match exact directory name or anything inside it
            return normalizedPath === dirPattern || normalizedPath.startsWith(dirPattern + '/');
        }

        // Handle patterns starting with '/' (match from root)
        if (pattern.startsWith('/')) {
            pattern = pattern.substring(1);
            // Must match the beginning of the path exactly
            if (pattern.includes('*')) {
                 const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*');
                 try { return new RegExp(regexPattern).test(normalizedPath); } catch (e) { return false; }
            } else {
                return normalizedPath === pattern || normalizedPath.startsWith(pattern + '/');
            }
        }

        // Handle patterns containing '/' but not starting with it (match anywhere)
        if (pattern.includes('/')) {
             if (pattern.includes('*')) {
                 const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*');
                 try { return new RegExp(regexPattern).test(normalizedPath); } catch (e) { return false; }
             } else {
                 // Exact segment match anywhere in the path
                 return ('/' + normalizedPath).includes('/' + pattern);
             }
        }

        // Handle patterns without '/' (match filename or directory name anywhere)
        if (!pattern.includes('/')) {
            const pathSegments = normalizedPath.split('/');
            if (pattern.includes('*')) {
                // Wildcard in filename/dirname
                const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
                try {
                    const regex = new RegExp(regexPattern);
                    return pathSegments.some(segment => regex.test(segment));
                } catch (e) { return false; }
            } else {
                // Exact filename/dirname match
                return pathSegments.some(segment => segment === pattern);
            }
        }

        return false; // Default no match
    }

    function formatSize(bytes) {
        if (bytes < 0) bytes = 0;
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes < k) return bytes + ' Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        let size = parseFloat((bytes / Math.pow(k, i)).toFixed(i < 2 ? 0 : 1));

        // Handle edge case where size rounds up to 1024
        if (size >= k && i < sizes.length - 1) {
             size = parseFloat((bytes / Math.pow(k, i + 1)).toFixed(1));
             return `${size} ${sizes[i + 1]}`;
         }

        return `${size} ${sizes[i]}`;
    }

    async function processPromisesBatch(promises, batchSize, progressCallback) {
        let results = [];
        let index = 0;
        while (index < promises.length) {
            const batch = promises.slice(index, index + batchSize);
            const batchResults = await Promise.all(batch);
            results = results.concat(batchResults);
            index += batch.length; // Use actual batch length
            if (progressCallback) {
                progressCallback(index, promises.length); // Report progress after batch completion
            }
            // Optional small delay between batches for API calls
            if (currentInputMode === 'url' && index < promises.length) {
                await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
            } else {
                 await new Promise(resolve => setTimeout(resolve, 0)); // Yield thread for local files
            }
        }
        return results;
    }

}); // End DOMContentLoaded