document.addEventListener('DOMContentLoaded', () => {
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
    const outputArea = document.getElementById('output'); // The main textarea
    const copyButton = document.getElementById('copyButton');
    const downloadTxtButton = document.getElementById('downloadTxtButton'); // Changed ID
    const downloadStatusDisplay = document.getElementById('downloadStatus');
    const filterModeSelect = document.getElementById('filterMode');
    const filterPatternsInput = document.getElementById('filterPatterns');
    const maxSizeSlider = document.getElementById('maxSizeSlider');
    const maxSizeValueDisplay = document.getElementById('maxSizeValue');
    const finalStatusDisplay = document.getElementById('finalStatus');

    // --- State Variables ---
    let currentMaxSizeBytes = parseInt(maxSizeSlider.value) * 1024;
    let currentInputMode = 'local';
    let gitignoreRules = [];
    let userFilterPatterns = [];
    let currentFilterMode = filterModeSelect.value;
    let processedFilesData = []; // Stores { path: string, content: string, size: number }
    let currentRepoName = 'codebase'; // Default name for root/download file

    // GitHub API limits
    const GITHUB_API_MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

    // --- Constants --- (Keep BINARY_EXTENSIONS and ALWAYS_IGNORE_PATTERNS as before)
    const BINARY_EXTENSIONS = new Set([
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', '.webp',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
        '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.iso', '.dmg',
        '.exe', '.dll', '.so', '.dylib', '.app', '.bin', '.msi',
        '.mp3', '.wav', '.ogg', '.flac', '.aac', '.mp4', '.avi', '.mov', '.webm', '.mkv', '.wmv',
        '.class', '.jar', '.pyc', '.pyd',
        '.lock', '.lockb',
        '.woff', '.woff2', '.ttf', '.otf', '.eot',
        '.sqlite', '.db', '.mdb',
        '.DS_Store', 'Thumbs.db'
    ]);
    const ALWAYS_IGNORE_PATTERNS = [
        '.git/', '.svn/', '.hg/', 'node_modules/', 'bower_components/', 'vendor/',
        'dist/', 'build/', 'out/', 'target/', 'coverage/', '__pycache__/', '*.pyc',
        '.DS_Store', 'Thumbs.db', '.env', '.idea/', '.vscode/', '*.log', '*.tmp', '*.temp',
        'package-lock.json', 'yarn.lock'
    ].map(p => ({ pattern: p, isDir: p.endsWith('/') }));

    const STRUCTURE_HEADER = "Directory structure:\n";
    const CONTENT_HEADER = "\n\n================================================\nFILE CONTENT:\n================================================\n\n";


    // --- Event Listeners ---
    modeLocalRadio.addEventListener('change', handleModeChange);
    modeUrlRadio.addEventListener('change', handleModeChange);
    folderInput.addEventListener('change', handleFolderSelect);
    fetchUrlButton.addEventListener('click', handleUrlFetch);
    copyButton.addEventListener('click', copyOutputToClipboard);
    downloadTxtButton.addEventListener('click', handleDownloadTxt); // Changed handler
    maxSizeSlider.addEventListener('input', updateMaxSize);
    filterModeSelect.addEventListener('change', () => { currentFilterMode = filterModeSelect.value; });
    filterPatternsInput.addEventListener('input', () => { userFilterPatterns = parseUserPatterns(filterPatternsInput.value); });

    // --- Initial Setup ---
    handleModeChange();
    updateMaxSize();
    resetUIState();

    // --- UI State Management ---
    function resetUIState(clearInputs = false) {
        outputArea.value = ''; // Clear the main output
        processedFilesData = [];
        copyButton.disabled = true;
        downloadTxtButton.disabled = true;
        downloadStatusDisplay.textContent = '';
        finalStatusDisplay.textContent = '';
        finalStatusDisplay.className = 'status-text'; // Reset status class

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

    function setStatus(message, type = 'info', target = 'final') {
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
             // Reset specific styles first
             displayElement.style.color = '';
             displayElement.className = 'status-text'; // Reset class for finalStatus

             // Apply new styles
            let color = 'var(--color-secondary)';
            let statusClass = '';
            if (isError) { color = 'var(--color-danger)'; statusClass = 'status-error'; }
            else if (isWarning) { color = 'var(--color-warning)'; statusClass = 'status-warning'; }
            else if (isSuccess) { color = 'var(--color-success)'; statusClass = 'status-success'; }

            displayElement.style.color = color;
            if(target === 'final' && statusClass) {
                displayElement.classList.add(statusClass);
            }
             if(target === 'download' && statusClass) {
                 displayElement.classList.add(statusClass); // Also apply class to download status
             }
        }

        if (message) {
             if (isError) console.error(message);
             else if (isWarning) console.warn(message);
             else console.log(message);
        }
    }

    function setUIDisabled(isDisabled) {
         modeLocalRadio.disabled = isDisabled;
         modeUrlRadio.disabled = isDisabled;
         // folderInput.disabled = isDisabled; // Input itself is hidden
         document.querySelector('label[for="folderInput"]').style.pointerEvents = isDisabled ? 'none' : 'auto';
         document.querySelector('label[for="folderInput"]').style.opacity = isDisabled ? '0.65' : '1';
         urlInput.disabled = isDisabled;
         fetchUrlButton.disabled = isDisabled;
         filterModeSelect.disabled = isDisabled;
         filterPatternsInput.disabled = isDisabled;
         maxSizeSlider.disabled = isDisabled;
         // Buttons enabled/disabled based on output content later
         if (isDisabled) {
             copyButton.disabled = true;
             downloadTxtButton.disabled = true;
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

        resetUIState();
        setStatus('⏳ Preparing... Reading filters...', 'info', 'local');
        setUIDisabled(true);

        const firstFilePath = files[0]?.webkitRelativePath;
        currentRepoName = firstFilePath ? firstFilePath.split('/')[0] : 'local_codebase';

        gitignoreRules = [];
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
        currentFilterMode = filterModeSelect.value;
        processedFilesData = []; // Reset processed data

        const sortedFiles = Array.from(files).sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath));

        const rootGitignoreFile = sortedFiles.find(f => f.webkitRelativePath === `${currentRepoName}/.gitignore`);
        if (rootGitignoreFile) {
             try { /* ... read gitignore (no changes needed here) ... */
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
        await new Promise(resolve => setTimeout(resolve, 20));

        let ignoredFileCount = 0;
        let readErrorCount = 0;
        const totalFiles = sortedFiles.length;
        const fileProcessingPromises = [];

        setStatus(`🔎 Analyzing ${totalFiles} local items...`, 'info', 'local');
        await new Promise(resolve => setTimeout(resolve, 0));

        for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            // --- Filtering logic (no changes needed here) ---
            if (!file.webkitRelativePath) { ignoredFileCount++; continue; }
            const firstSlashIndex = file.webkitRelativePath.indexOf('/');
            const relativePathInRepo = firstSlashIndex !== -1 ? file.webkitRelativePath.substring(firstSlashIndex + 1) : file.webkitRelativePath;
            if (!relativePathInRepo) { ignoredFileCount++; continue; }
            if (!shouldProcessFile(relativePathInRepo, file.size, file.name)) {
                ignoredFileCount++;
                continue;
            }
            // --- Add promise ---
            fileProcessingPromises.push(
                readFileContentLocal(file)
                    .then(content => ({ path: relativePathInRepo, content: content, size: file.size }))
                    .catch(error => {
                        console.warn(`Skipping local file ${relativePathInRepo}: ${error.message}`);
                        return { path: relativePathInRepo, content: null, error: true, size: file.size };
                    })
            );
             if (i % 150 === 0 || i === totalFiles - 1) { // Update status periodically
                 setStatus(`🔎 Analyzing local item ${i + 1}/${totalFiles}... (Filtered: ${ignoredFileCount})`, 'info', 'local');
                 await new Promise(resolve => setTimeout(resolve, 0));
             }
        }

        const filesToReadCount = fileProcessingPromises.length;
        setStatus(`📚 Reading ${filesToReadCount} filtered local files...`, 'info', 'local');
        await new Promise(resolve => setTimeout(resolve, 0));

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

        // --- Generate Output ---
        setStatus('🌲 Generating directory structure...', 'info', 'local');
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield
        const structureText = generateDirectoryStructureText(processedFilesData, currentRepoName);

        setStatus('📝 Combining output...', 'info', 'local');
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield
        let combinedOutput = STRUCTURE_HEADER + structureText;
        combinedOutput += CONTENT_HEADER;

        processedFilesData.forEach(file => {
             combinedOutput += `--- FILENAME: ${file.path} ---\n`;
             combinedOutput += file.content + '\n\n';
        });

        outputArea.value = combinedOutput;
        setStatus(`✅ Done. Processed ${processedFileCount} files. Filtered/Ignored ${ignoredFileCount}. Read errors: ${readErrorCount}. Total items: ${totalFiles}.`, 'success', 'final');
        folderInput.value = null;
        setUIDisabled(false);
        copyButton.disabled = combinedOutput.length === 0;
        downloadTxtButton.disabled = combinedOutput.length === 0;
    }

    // --- Core Logic: Git URL ---
    async function handleUrlFetch() {
        const repoUrl = urlInput.value.trim();
        if (!repoUrl) { /* ... */ return; }
        const repoInfo = parseGitHubUrl(repoUrl);
        if (!repoInfo) { /* ... */ return; }

        resetUIState();
        setStatus('⏳ Preparing... Reading filters...', 'info', 'url');
        setUIDisabled(true);

        currentRepoName = repoInfo.repo;
        gitignoreRules = [];
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
        currentFilterMode = filterModeSelect.value;
        processedFilesData = [];

        let allFilesMeta = [];

        try {
            setStatus(`⏳ Fetching file list for ${repoInfo.owner}/${repoInfo.repo}...`, 'info', 'url');
            allFilesMeta = await fetchRepoContentsRecursive(repoInfo.owner, repoInfo.repo, '');

            const rootGitignoreMeta = allFilesMeta.find(f => f.path === '.gitignore' && f.type === 'file');
            if (rootGitignoreMeta) {
                try { /* ... read gitignore ... */
                    setStatus('⏳ Reading root .gitignore...', 'info', 'url');
                    const gitignoreContent = await fetchFileContentFromAPI(repoInfo.owner, repoInfo.repo, rootGitignoreMeta.path, rootGitignoreMeta.size);
                    gitignoreRules = parseGitignore(gitignoreContent);
                    setStatus(`ℹ️ Found ${gitignoreRules.length} rules in .gitignore.`, 'info', 'url');
                } catch (error) {
                    setStatus(`⚠️ Could not read root .gitignore: ${error.message}.`, 'warning', 'url');
                }
            } else {
                 setStatus('ℹ️ No root .gitignore found.', 'info', 'url');
            }
            await new Promise(resolve => setTimeout(resolve, 50));

            let ignoredItemCount = 0;
            let readErrorCount = 0;
            let skippedApiLimitCount = 0;
            const totalItems = allFilesMeta.length;
            const fileProcessingPromises = [];

            setStatus(`🔎 Analyzing ${totalItems} repository items...`, 'info', 'url');
            await new Promise(resolve => setTimeout(resolve, 0));

            for (let i = 0; i < allFilesMeta.length; i++) {
                const item = allFilesMeta[i];
                // --- Filtering logic (no changes needed here) ---
                if (item.type !== 'file') { ignoredItemCount++; continue; }
                if (item.size > GITHUB_API_MAX_FILE_SIZE_BYTES) { skippedApiLimitCount++; ignoredItemCount++; continue; }
                const fileName = item.path.split('/').pop();
                if (!shouldProcessFile(item.path, item.size, fileName)) { ignoredItemCount++; continue; }
                // --- Add promise ---
                 fileProcessingPromises.push(
                    fetchFileContentFromAPI(repoInfo.owner, repoInfo.repo, item.path, item.size)
                        .then(content => ({ path: item.path, content: content, size: item.size }))
                        .catch(error => {
                            console.warn(`Skipping repo file ${item.path}: ${error.message}`);
                            return { path: item.path, content: null, error: true, size: item.size };
                        })
                );
                 if (i % 50 === 0 || i === totalItems - 1) { // Update status periodically
                     setStatus(`🔎 Analyzing repository item ${i + 1}/${totalItems}... (Filtered: ${ignoredItemCount}, API Skip: ${skippedApiLimitCount})`, 'info', 'url');
                     await new Promise(resolve => setTimeout(resolve, 0));
                 }
            }

            const filesToReadCount = fileProcessingPromises.length;
            setStatus(`📚 Fetching content for ${filesToReadCount} filtered files via API...`, 'info', 'url');
            await new Promise(resolve => setTimeout(resolve, 0));

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
            const processedDirs = allFilesMeta.filter(item => item.type === 'dir').length;
             ignoredItemCount = totalItems - processedFileCount - readErrorCount - processedDirs;


            // --- Generate Output ---
            setStatus('🌲 Generating directory structure...', 'info', 'url');
            await new Promise(resolve => setTimeout(resolve, 0)); // Yield
            const structureText = generateDirectoryStructureText(processedFilesData, currentRepoName);

            setStatus('📝 Combining output...', 'info', 'url');
            await new Promise(resolve => setTimeout(resolve, 0)); // Yield
             let combinedOutput = STRUCTURE_HEADER + structureText;
            combinedOutput += CONTENT_HEADER;

             processedFilesData.forEach(file => {
                 combinedOutput += `--- FILENAME: ${file.path} ---\n`;
                 combinedOutput += file.content + '\n\n';
             });

            outputArea.value = combinedOutput;
            const finalMessage = `✅ Done. Processed ${processedFileCount} files. Filtered/Ignored ${ignoredItemCount} items. Read errors: ${readErrorCount}. API Skips (>1MB): ${skippedApiLimitCount}. Total items listed: ${totalItems}.`;
            setStatus(finalMessage, 'success', 'final');
             copyButton.disabled = combinedOutput.length === 0;
             downloadTxtButton.disabled = combinedOutput.length === 0;

        } catch (error) {
            console.error("Error fetching repository data:", error);
            setStatus(`❌ Error: ${error.message}. Check URL or GitHub API status/rate limits.`, 'error', 'final');
             outputArea.value = `Failed to process repository.\nError: ${error.message}`;
             copyButton.disabled = true;
             downloadTxtButton.disabled = true;
        } finally {
             setUIDisabled(false);
        }
    }

    // --- Directory Structure Generation ---

    function buildFileTreeData(files) {
        // This helper function remains the same as in the previous version
        const tree = {};
        files.sort((a, b) => a.path.localeCompare(b.path)).forEach(file => {
            const pathParts = file.path.split('/');
            let currentLevel = tree;
            pathParts.forEach((part, index) => {
                if (!part) return;
                if (index === pathParts.length - 1) { // File
                    currentLevel[part] = { type: 'file' }; // Don't need size/content here
                } else { // Directory
                    if (!currentLevel[part]) {
                        currentLevel[part] = { type: 'dir', children: {} };
                    }
                    // Ensure we handle potential conflicts where a file and dir have the same name stem
                    if (currentLevel[part].type === 'file') {
                         console.warn(`Path conflict resolved: Treating "${part}" as directory over file due to deeper path.`);
                         currentLevel[part] = { type: 'dir', children: {} };
                    }
                    currentLevel = currentLevel[part].children;
                }
            });
        });
        return tree;
    }

    function generateDirectoryStructureText(files, rootDirName = 'repository') {
        if (!files || files.length === 0) {
            return `└── ${rootDirName}/\n    (No processable files found)\n`;
        }
        const treeData = buildFileTreeData(files);
        let structure = `└── ${rootDirName}/\n`; // Start with root directory

        function renderTextNode(nodes, prefix) {
            const keys = Object.keys(nodes).sort(); // Ensure consistent order
            keys.forEach((key, index) => {
                const node = nodes[key];
                const isLast = index === keys.length - 1;
                const connector = isLast ? '└── ' : '├── ';
                const nodePrefix = prefix + connector;
                structure += nodePrefix + key + (node.type === 'dir' ? '/' : '') + '\n';

                if (node.type === 'dir' && node.children && Object.keys(node.children).length > 0) {
                    const childPrefix = prefix + (isLast ? '    ' : '│   ');
                    renderTextNode(node.children, childPrefix);
                }
            });
        }

        renderTextNode(treeData, '    '); // Initial prefix for items inside the root

        return structure;
    }


    // --- Download Functionality ---

    function handleDownloadTxt() {
        const content = outputArea.value;
        if (!content) {
            setStatus('No output content to download.', 'warning', 'download');
            return;
        }

        setStatus('💾 Preparing download...', 'info', 'download');

        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${currentRepoName}_ingest.txt`; // Use repo/folder name
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href); // Clean up blob URL

            setStatus('✅ Download ready.', 'success', 'download');
            // Clear status after a few seconds
            setTimeout(() => setStatus('', 'info', 'download'), 3000);

        } catch (error) {
            console.error("Error creating text file download:", error);
            setStatus(`❌ Download failed: ${error.message}`, 'error', 'download');
        }
    }

    // --- Copy Functionality ---
    function copyOutputToClipboard() {
        if (!outputArea.value) return;
        navigator.clipboard.writeText(outputArea.value)
            .then(() => {
                 const originalStatus = finalStatusDisplay.textContent;
                 const originalButtonText = copyButton.textContent;
                 setStatus('✅ Output copied to clipboard!', 'success', 'final'); // Use final status for copy feedback
                 copyButton.textContent = 'Copied!';
                 copyButton.classList.add('copied');

                setTimeout(() => {
                    copyButton.textContent = originalButtonText;
                    copyButton.classList.remove('copied');
                     // Restore original final status ONLY if it hasn't changed due to another operation
                     if (finalStatusDisplay.textContent === '✅ Output copied to clipboard!') {
                          // Best effort: Re-parse the status from the text if possible
                          const statusMatch = originalStatus.match(/^(✅|❌|⚠️|ℹ️|⏳)\s*(.*)/);
                          if (statusMatch) {
                               const typeMap = {'✅': 'success', '❌': 'error', '⚠️': 'warning', 'ℹ️': 'info', '⏳': 'info'};
                               setStatus(originalStatus, typeMap[statusMatch[1]] || 'info', 'final');
                          } else {
                               setStatus(originalStatus, 'info', 'final'); // Default restore
                          }
                     }
                }, 2500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                setStatus('❌ Failed to copy. See console.', 'error', 'final');
                // Simple alert fallback
                 alert('Automatic copy failed. Please select the text in the box and copy manually (Ctrl+C or Cmd+C).');
            });
    }


    // --- Utility Functions --- (Keep parseUserPatterns, parseGitignore, shouldProcessFile, isLikelyBinaryByExtension, matchesSimplePattern, formatSize, readFileContentLocal, fetchRepoContentsRecursive, fetchFileContentFromAPI, processPromisesBatch, parseGitHubUrl - No changes needed in these helpers from the previous script.js version)
    function parseUserPatterns(patternsString) {
        if (!patternsString) return [];
        return patternsString.split(',').map(p => p.trim()).filter(p => p);
    }

    function parseGitignore(content) {
        if (!content) return [];
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

     function shouldProcessFile(relativePath, fileSize, fileName) {
         if (!relativePath || relativePath === '.git') return false;
         for (const { pattern, isDir } of ALWAYS_IGNORE_PATTERNS) {
             if (matchesSimplePattern(relativePath, pattern, isDir)) {
                 return false;
             }
         }
         if (fileSize > currentMaxSizeBytes) {
             return false;
         }
         if (isLikelyBinaryByExtension(fileName)) {
             return false;
         }
         const userPatterns = parseUserPatterns(filterPatternsInput.value);
         const filterMode = filterModeSelect.value;
         let matchesUserPattern = false;
         if (userPatterns.length > 0) {
             matchesUserPattern = userPatterns.some(p => matchesSimplePattern(relativePath, p));
         }
         if (filterMode === 'Include') {
             if (userPatterns.length > 0 && !matchesUserPattern) {
                 return false;
             }
         } else {
             if (userPatterns.length > 0 && matchesUserPattern) {
                 return false;
             }
         }
         // Handle .gitignore itself - allow unless explicitly excluded by user
         if (relativePath.endsWith('/.gitignore') || relativePath === '.gitignore') {
             if(filterMode === 'Exclude' && matchesUserPattern) return false; // User excluded it
             return true; // Otherwise, allow it
         }
         for (const rule of gitignoreRules) {
              const trimmedRule = rule.trim();
              if (!trimmedRule || trimmedRule.startsWith('#') || trimmedRule.startsWith('!')) continue; // Ignore comments, empty, negation
             if (matchesSimplePattern(relativePath, trimmedRule)) {
                 return false;
             }
         }
         return true;
     }

     function isLikelyBinaryByExtension(filename) {
         if (!filename) return false;
         const lowerFilename = filename.toLowerCase();
         const lastDotIndex = lowerFilename.lastIndexOf('.');
         if (lastDotIndex < 1 || lastDotIndex === lowerFilename.length - 1) {
              return BINARY_EXTENSIONS.has(lowerFilename);
         }
         const extension = lowerFilename.substring(lastDotIndex);
         return BINARY_EXTENSIONS.has(extension);
     }

     function matchesSimplePattern(path, pattern, isDirPattern = pattern.endsWith('/')) {
         // --- Same matching logic as before ---
         const normalizedPath = path.replace(/\\/g, '/');
         pattern = pattern.trim();
         if (isDirPattern) {
             const dirPattern = pattern.slice(0, -1);
             return normalizedPath === dirPattern || normalizedPath.startsWith(dirPattern + '/');
         }
         if (pattern.startsWith('/')) {
             pattern = pattern.substring(1);
              if (pattern.includes('*')) {
                  const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*');
                  try { return new RegExp(regexPattern).test(normalizedPath); } catch (e) { return false; }
              } else {
                  return normalizedPath === pattern || normalizedPath.startsWith(pattern + '/');
              }
         }
         if (pattern.includes('/')) {
              if (pattern.includes('*')) {
                  const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*');
                  try { return new RegExp(regexPattern).test(normalizedPath); } catch (e) { return false; }
              } else {
                  return ('/' + normalizedPath).includes('/' + pattern);
              }
         }
         if (!pattern.includes('/')) {
             const pathSegments = normalizedPath.split('/');
             if (pattern.includes('*')) {
                 const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
                 try {
                     const regex = new RegExp(regexPattern);
                     return pathSegments.some(segment => regex.test(segment));
                 } catch (e) { return false; }
             } else {
                 return pathSegments.some(segment => segment === pattern);
             }
         }
         return false;
     }

     function formatSize(bytes) {
         if (bytes < 0) bytes = 0;
         if (bytes === 0) return '0 Bytes';
         const k = 1024;
         const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
         if (bytes < k) return bytes + ' Bytes';
         const i = Math.floor(Math.log(bytes) / Math.log(k));
         let size = parseFloat((bytes / Math.pow(k, i)).toFixed(i < 2 ? 0 : 1));
         if (size >= k && i < sizes.length - 1) {
              size = parseFloat((bytes / Math.pow(k, i + 1)).toFixed(1));
              return `${size} ${sizes[i + 1]}`;
          }
         return `${size} ${sizes[i]}`;
     }

     function readFileContentLocal(file, sizeLimitOverride = null) {
         return new Promise((resolve, reject) => {
             const sizeLimit = sizeLimitOverride !== null ? sizeLimitOverride : currentMaxSizeBytes;
             if (file.size > sizeLimit) {
                 return reject(new Error(`Size (${formatSize(file.size)}) exceeds limit (${formatSize(sizeLimit)})`));
             }
             if (file.size === 0) return resolve("");
             const reader = new FileReader();
             reader.onload = (event) => {
                 const text = event.target.result;
                 if (text && text.indexOf('\u0000') !== -1) {
                     reject(new Error(`Detected null byte, likely binary: ${file.name}`));
                 } else { resolve(text); }
             };
             reader.onerror = (event) => reject(new Error(`Error reading file ${file.name}: ${reader.error}`));
             reader.readAsText(file);
         });
     }

     async function fetchRepoContentsRecursive(owner, repo, path = '', accumulatedFiles = []) {
         // --- Same API fetching logic as before ---
         const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
         const response = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
         if (!response.ok) {
             let errorMsg = `GitHub API Error (${response.status}) for path "/${path}".`;
              try { const errorData = await response.json(); errorMsg = `GitHub API Error: ${errorData.message || response.statusText} (for path "/${path}")`; } catch (e) { /* Ignore */ }
              if (response.status === 404) errorMsg = `Repository or path not found: ${owner}/${repo}/${path}`;
              if (response.status === 403) {
                 const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
                  if (rateLimitRemaining && parseInt(rateLimitRemaining) === 0) {
                      const resetTime = new Date(parseInt(response.headers.get('X-RateLimit-Reset')) * 1000);
                      errorMsg = `GitHub API rate limit exceeded. Try again after ${resetTime.toLocaleTimeString()}.`;
                  } else { errorMsg = `Access denied for ${owner}/${repo}/${path}. Is it private?`; }
             }
             throw new Error(errorMsg);
         }
         const items = await response.json();
          if (!Array.isArray(items)) { // Handle single item response
              if (items.type === 'file' || items.type === 'dir') {
                  accumulatedFiles.push({ path: items.path, size: items.size, sha: items.sha, type: items.type, url: items.url });
                  if (items.type === 'dir') await fetchRepoContentsRecursive(owner, repo, items.path, accumulatedFiles);
                  return accumulatedFiles;
              } else { throw new Error(`Unexpected API response format for path "${path}".`); }
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

     async function fetchFileContentFromAPI(owner, repo, filePath, fileSize) {
          // --- Same API content fetching logic as before ---
         if (fileSize > GITHUB_API_MAX_FILE_SIZE_BYTES) throw new Error(`File size (${formatSize(fileSize)}) > GitHub API limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`);
         if (fileSize === 0) return "";
         const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
         const response = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3.raw' } });
         if (!response.ok) {
              let errorMsg = `GitHub API content fetch error (${response.status}) for "${filePath}".`;
              if (response.status === 403) errorMsg = `Access denied or rate limit fetching content for "${filePath}".`;
               // Try JSON fallback for base64
               try {
                  const jsonResponse = await fetch(apiUrl.replace('.raw', '+json')); // Adjust URL for json
                  if (jsonResponse.ok) {
                      const fileData = await jsonResponse.json();
                      if (fileData.encoding === 'base64' && fileData.content) {
                          if (fileData.size > GITHUB_API_MAX_FILE_SIZE_BYTES) throw new Error(`File size (${formatSize(fileData.size)}) > GitHub API limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`);
                          try {
                              const decodedContent = atob(fileData.content);
                              if (decodedContent.indexOf('\u0000') !== -1) throw new Error(`Detected null byte after decoding base64: ${filePath}`);
                              return decodedContent;
                          } catch (e) { throw new Error(`Failed to decode Base64 for ${filePath}: ${e.message}`); }
                      }
                  }
               } catch (e) { /* ignore fallback error */ }
              throw new Error(errorMsg);
         }
         const content = await response.text();
         if (content && content.indexOf('\u0000') !== -1) throw new Error(`Detected null byte in raw content: ${filePath}`);
         return content;
     }

     async function processPromisesBatch(promises, batchSize, progressCallback) {
          // --- Same batch processing logic as before ---
         let results = []; let index = 0;
         while (index < promises.length) {
             const batch = promises.slice(index, index + batchSize);
             const batchResults = await Promise.all(batch);
             results = results.concat(batchResults);
             index += batch.length;
             if (progressCallback) progressCallback(index, promises.length);
             const delay = (currentInputMode === 'url' && index < promises.length) ? 50 : 0;
             await new Promise(resolve => setTimeout(resolve, delay));
         }
         return results;
     }

     function parseGitHubUrl(url) {
        // --- Same URL parsing logic as before ---
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

}); // End DOMContentLoaded