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
    const filterModeSelect = document.getElementById('filterMode');
    const filterPatternsInput = document.getElementById('filterPatterns');
    const maxSizeSlider = document.getElementById('maxSizeSlider');
    const maxSizeValueDisplay = document.getElementById('maxSizeValue');
    const finalStatusDisplay = document.getElementById('finalStatus'); // In controls panel

    const resultsArea = document.getElementById('resultsArea');
    const outputCodeElement = document.getElementById('output').querySelector('code'); // Target <code>
    const copyOutputButton = document.getElementById('copyOutputButton');
    const downloadTxtButton = document.getElementById('downloadTxtButton');
    const downloadStatusDisplay = document.getElementById('downloadStatus'); // In results header

    // --- State Variables ---
    let currentMaxSizeBytes = parseInt(maxSizeSlider.value) * 1024;
    let currentInputMode = 'local';
    let gitignoreRules = [];
    let userFilterPatterns = [];
    let currentFilterMode = filterModeSelect.value;
    let processedFilesData = []; // Stores { path: string, content: string, size: number }
    let currentRepoName = 'codebase'; // Default name for root/download file
    let fullCombinedOutput = ''; // Store the full combined output for copy/download

    // --- Constants ---
    const GITHUB_API_MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;
    const STRUCTURE_HEADER = "Directory structure:\n";
    const CONTENT_HEADER = "\n\n\n================================================\nFILE CONTENT:\n================================================\n\n";
    const COMBINED_SEPARATOR = CONTENT_HEADER; // Use content header as separator

    // (Keep BINARY_EXTENSIONS and ALWAYS_IGNORE_PATTERNS as before)
     const BINARY_EXTENSIONS = new Set([ '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.iso', '.dmg', '.exe', '.dll', '.so', '.dylib', '.app', '.bin', '.msi', '.mp3', '.wav', '.ogg', '.flac', '.aac', '.mp4', '.avi', '.mov', '.webm', '.mkv', '.wmv', '.class', '.jar', '.pyc', '.pyd', '.lock', '.lockb', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.sqlite', '.db', '.mdb', '.DS_Store', 'Thumbs.db' ]);
     const ALWAYS_IGNORE_PATTERNS = [ '.git/', '.svn/', '.hg/', 'node_modules/', 'bower_components/', 'vendor/', 'dist/', 'build/', 'out/', 'target/', 'coverage/', '__pycache/', '*.pyc', '.DS_Store', 'Thumbs.db', '.env', '.idea/', '.vscode/', '*.log', '*.tmp', '*.temp', 'package-lock.json', 'yarn.lock' ].map(p => ({ pattern: p, isDir: p.endsWith('/') }));


    // --- Event Listeners ---
    modeLocalRadio.addEventListener('change', handleModeChange);
    modeUrlRadio.addEventListener('change', handleModeChange);
    folderInput.addEventListener('change', handleFolderSelect); // Corrected listener attachment
    fetchUrlButton.addEventListener('click', handleUrlFetch);
    maxSizeSlider.addEventListener('input', updateMaxSize); // Update text and visual
    filterModeSelect.addEventListener('change', () => { currentFilterMode = filterModeSelect.value; });
    filterPatternsInput.addEventListener('input', () => { userFilterPatterns = parseUserPatterns(filterPatternsInput.value); });
    copyOutputButton.addEventListener('click', () => copyToClipboard(fullCombinedOutput, copyOutputButton, 'Output'));
    downloadTxtButton.addEventListener('click', handleDownloadTxt);

    // --- Initial Setup ---
    handleModeChange();
    updateMaxSize(); // Initial call to set text and slider background
    resetUIState();

    // --- UI State Management ---
    function resetUIState(clearInputs = false) {
        resultsArea.style.display = 'none'; // Hide results initially
        outputCodeElement.textContent = ''; // Clear output code element
        finalStatusDisplay.textContent = ''; // Clear final status
        finalStatusDisplay.className = 'status-text'; // Reset class
        downloadStatusDisplay.textContent = ''; // Clear download status
        downloadStatusDisplay.className = 'status-text'; // Reset class

        processedFilesData = [];
        fullCombinedOutput = '';
        currentRepoName = 'codebase'; // Reset repo name

        // Disable results buttons
        copyOutputButton.disabled = true;
        downloadTxtButton.disabled = true;

        if (clearInputs) {
            folderInput.value = null; // Clear file input selection
            urlInput.value = '';
            localStatusDisplay.textContent = 'No folder selected.';
            urlStatusDisplay.textContent = 'Enter public GitHub URL.';
        }
    }

    function handleModeChange() {
        currentInputMode = document.querySelector('input[name="inputMode"]:checked').value;
        resetUIState(true); // Clear everything when mode changes

        if (currentInputMode === 'local') {
            localModeSection.style.display = 'flex'; // Use flex for alignment
            urlModeSection.style.display = 'none';
        } else { // url mode
            localModeSection.style.display = 'none';
            urlModeSection.style.display = 'flex'; // Use flex for alignment
        }
    }

    function updateMaxSize() {
        const kbValue = parseInt(maxSizeSlider.value);
        currentMaxSizeBytes = kbValue * 1024;
        maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
        updateSliderBackground(); // Update visual style
    }

    // Update slider background using CSS variable
    function updateSliderBackground() {
        const percentage = (parseInt(maxSizeSlider.value) / parseInt(maxSizeSlider.max)) * 100;
        // Set CSS variable '--value-percent' on the slider itself
        maxSizeSlider.style.setProperty('--value-percent', `${percentage}%`);
    }

    function setStatus(message, type = 'info', target = 'final') {
         // Simplified status logic - mostly targets 'final' or 'download'
         let displayElement;
         let isError = (type === 'error');
         let isWarning = (type === 'warning');
         let isSuccess = (type === 'success');

         if (target === 'download') {
             displayElement = downloadStatusDisplay;
         } else { // Default to final/general status
             displayElement = finalStatusDisplay;
         }

         if (displayElement) {
             displayElement.textContent = message;
              displayElement.className = 'status-text'; // Reset class first

             let statusClass = '';
             if (isError) { statusClass = 'status-error'; }
             else if (isWarning) { statusClass = 'status-warning'; }
             else if (isSuccess) { statusClass = 'status-success'; }

             if(statusClass) {
                 displayElement.classList.add(statusClass);
             }
         }
         // Log important messages
         if (message && target === 'final') {
              if (isError) console.error(message); else if (isWarning) console.warn(message); else console.log(message);
         }
    }

    function setUIDisabled(isDisabled) {
        // Disable inputs/filters in the control panel
        [modeLocalRadio, modeUrlRadio, urlInput, fetchUrlButton, filterModeSelect, filterPatternsInput, maxSizeSlider]
            .forEach(el => { if (el) el.disabled = isDisabled; });

        // Handle the "Select Folder" button's label interaction
        const folderLabel = document.querySelector('label[for="folderInput"]');
        if (folderLabel) {
             folderLabel.style.pointerEvents = isDisabled ? 'none' : 'auto';
             folderLabel.style.opacity = isDisabled ? '0.65' : '1';
             if (isDisabled) {
                folderLabel.classList.add('disabled'); // Add class for potential styling
             } else {
                folderLabel.classList.remove('disabled');
             }
        }


        // Results buttons are handled separately based on data
        if (isDisabled) {
             copyOutputButton.disabled = true;
             downloadTxtButton.disabled = true;
        }
    }


    // --- Core Processing Logic (Common for Local/URL) ---
    async function processFiles(fileFetchFunction) {
         resetUIState(); // Clear previous results from UI
         const modeStatusTarget = currentInputMode === 'local' ? 'local' : 'url'; // Use specific status areas during fetch prep
         setStatus(`⏳ Preparing...`, 'info', modeStatusTarget);
         setUIDisabled(true);

         gitignoreRules = [];
         userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
         currentFilterMode = filterModeSelect.value;
         processedFilesData = []; // Reset internal data store

         try {
             // 1. Fetch file list and metadata
             const { filesToProcess, totalItems, repoName } = await fileFetchFunction();
             currentRepoName = repoName || 'codebase'; // Update repo name

             // Clear mode-specific status now that fetching is done
             setStatus('', 'info', 'local');
             setStatus('', 'info', 'url');


             if (filesToProcess.length === 0 && totalItems === 0) {
                  setStatus(`✅ No items found or folder empty.`, 'warning', 'final');
                  setUIDisabled(false);
                  return;
             }

             // 2. Read .gitignore (if present)
             setStatus(`🔎 Found ${totalItems} items. Processing filters...`, 'info', 'final');
             const gitignoreFile = filesToProcess.find(f => f.isGitignore);
             if (gitignoreFile) {
                  try {
                      const gitignoreContent = await gitignoreFile.read();
                      gitignoreRules = parseGitignore(gitignoreContent);
                      console.log(`Parsed ${gitignoreRules.length} rules from .gitignore.`);
                  } catch (error) {
                      setStatus(`⚠️ Could not read .gitignore: ${error.message}.`, 'warning', 'final');
                      console.warn("Gitignore read error:", error);
                  }
             } else {
                 console.log("No root .gitignore found.");
             }
              await new Promise(resolve => setTimeout(resolve, 10)); // Yield thread

             // 3. Filter files and prepare read promises
             let ignoredCount = 0;
             let readErrorCount = 0;
             let skippedApiLimitCount = 0;
             const fileProcessingPromises = [];

             for (const file of filesToProcess) {
                  // Skip gitignore now
                  if (file.isGitignore) continue;

                  // API limit check (URL mode)
                   if (currentInputMode === 'url' && file.size > GITHUB_API_MAX_FILE_SIZE_BYTES) {
                       skippedApiLimitCount++;
                       ignoredCount++;
                       continue;
                   }

                   // Apply all other filters
                  if (!shouldProcessFile(file.path, file.size, file.name)) {
                      ignoredCount++;
                      continue;
                  }

                  // Add read promise if it passes filters
                  fileProcessingPromises.push(
                      file.read()
                          .then(content => ({ path: file.path, content: content, size: file.size }))
                          .catch(error => {
                              console.warn(`Skipping file ${file.path}: ${error.message}`);
                              return { path: file.path, content: null, error: true, size: file.size };
                          })
                  );
             }
              ignoredCount += (totalItems - filesToProcess.length); // Account for items filtered out initially (e.g., directories)


             // 4. Read File Contents in Batches
             const filesToReadCount = fileProcessingPromises.length;
             if (filesToReadCount === 0) {
                  setStatus(`✅ No files passed filters. ${ignoredCount} items ignored.`, 'info', 'final');
                  setUIDisabled(false);
                  resultsArea.style.display = 'block'; // Show empty results area
                  outputCodeElement.textContent = "(No files matched the criteria)";
                  return;
             }

             setStatus(`📚 Reading ${filesToReadCount} filtered files...`, 'info', 'final');
             const batchSize = currentInputMode === 'local' ? 20 : 5; // Adjust batch size
             const results = await processPromisesBatch(fileProcessingPromises, batchSize, (done, total) => {
                   // Update status less frequently to avoid spamming
                   if (done % batchSize === 0 || done === total) {
                        setStatus(`📚 Reading file ${done}/${total}...`, 'info', 'final');
                   }
             });

             // 5. Process Read Results
             let processedFileCount = 0;
             processedFilesData = []; // Ensure clean
             results.forEach(result => {
                   if (result && result.content !== null) {
                       processedFilesData.push({ path: result.path, content: result.content, size: result.size });
                       processedFileCount++;
                   } else if (result && result.error) {
                      readErrorCount++;
                  }
             });

             // Recalculate ignored count
             ignoredCount = totalItems - processedFileCount - readErrorCount - (gitignoreFile ? 1 : 0);
             ignoredCount = Math.max(0, ignoredCount); // Ensure non-negative

             // 6. Generate Combined Output
             setStatus('🌲 Generating output...', 'info', 'final');
             await new Promise(resolve => setTimeout(resolve, 0)); // Yield

             const structureText = generateDirectoryStructureText(processedFilesData, currentRepoName);
             let contentText = '';
             processedFilesData.forEach(file => {
                  contentText += `--- FILENAME: ${file.path} ---\n`;
                  contentText += file.content + '\n\n';
             });

             fullCombinedOutput = structureText + COMBINED_SEPARATOR + contentText; // Store full output

             // 7. Display Output and Final Status
             outputCodeElement.textContent = fullCombinedOutput; // Display full output
             resultsArea.style.display = 'block'; // Show results

             let finalMessage = `✅ Done. Processed ${processedFileCount} files.`;
             if (ignoredCount > 0) finalMessage += ` Ignored/Filtered ${ignoredCount}.`;
             if (readErrorCount > 0) finalMessage += ` Read errors: ${readErrorCount}.`;
             if (currentInputMode === 'url' && skippedApiLimitCount > 0) finalMessage += ` API Skips (>1MB): ${skippedApiLimitCount}.`;
             // finalMessage += ` Total items analyzed: ${totalItems}.`; // Can be confusing if dirs are counted
             setStatus(finalMessage, 'success', 'final');

             // 8. Enable Buttons
             copyOutputButton.disabled = !fullCombinedOutput;
             downloadTxtButton.disabled = !fullCombinedOutput;

         } catch (error) {
             console.error("Processing error:", error);
             setStatus(`❌ Error: ${error.message}`, 'error', 'final');
             resultsArea.style.display = 'none'; // Hide results on error
         } finally {
             setUIDisabled(false); // Re-enable UI
             // Clear transient status messages
             setStatus('', 'info', 'local');
             setStatus('', 'info', 'url');
         }
    }


    // --- Specific Fetch/Setup Functions ---

    // **Crucially fixed**: Ensure event fires and files are processed
    async function handleFolderSelect(event) {
        console.log('Folder input changed!'); // Debug log
        const files = event.target.files;
        if (!files || files.length === 0) {
            console.log('No files selected or event target files empty.');
            setStatus('No folder selected or folder is empty.', 'warning', 'local');
            // Maybe clear results if a previous run existed?
            // resetUIState();
            return;
        }
        console.log(`Selected ${files.length} items.`);
        localStatusDisplay.textContent = `${files.length} items selected.`; // Update status immediately

        // Wrap the file processing logic for processFiles
        await processFiles(async () => {
             const fileList = Array.from(files);
             const rootFolderName = fileList[0]?.webkitRelativePath?.split('/')[0] || 'local_codebase';

             const filesToProcess = fileList.map(file => {
                  if (!file.webkitRelativePath) {
                      console.warn("File missing webkitRelativePath:", file.name);
                      return null; // Skip files without path (shouldn't happen with webkitdirectory)
                  }
                  const firstSlashIndex = file.webkitRelativePath.indexOf('/');
                  const relativePath = firstSlashIndex !== -1 ? file.webkitRelativePath.substring(firstSlashIndex + 1) : file.webkitRelativePath;

                   return {
                      path: relativePath,
                      name: file.name,
                      size: file.size,
                      isGitignore: relativePath === '.gitignore',
                      read: () => readFileContentLocal(file) // Closure to read this specific file
                   };
             }).filter(f => f && f.path); // Filter out nulls and items without relative path

              return {
                 filesToProcess: filesToProcess,
                 totalItems: fileList.length, // Total items initially selected
                 repoName: rootFolderName
              };
        });
        // Do NOT reset folderInput.value here, it prevents re-selecting the same folder if needed
    }

    async function handleUrlFetch() {
        const repoUrl = urlInput.value.trim();
        if (!repoUrl) { setStatus('Please enter a GitHub URL.', 'warning', 'url'); return; }
        const repoInfo = parseGitHubUrl(repoUrl);
        if (!repoInfo) { setStatus('Invalid GitHub URL format.', 'error', 'url'); return; }

        urlStatusDisplay.textContent = 'Fetching...'; // Immediate feedback

        await processFiles(async () => {
             const allFilesMeta = await fetchRepoContentsRecursive(repoInfo.owner, repoInfo.repo, '');

             const filesToProcess = allFilesMeta
                 .filter(item => item.type === 'file') // Process only files initially
                 .map(item => ({
                     path: item.path,
                     name: item.path.split('/').pop(),
                     size: item.size,
                     isGitignore: item.path === '.gitignore',
                     read: () => fetchFileContentFromAPI(repoInfo.owner, repoInfo.repo, item.path, item.size)
                 }));

             return {
                 filesToProcess: filesToProcess,
                 totalItems: allFilesMeta.length, // Includes directories listed by API
                 repoName: `${repoInfo.owner}/${repoInfo.repo}`
             };
        });
    }

    // --- Directory Structure Generation ---
    // buildFileTreeData and generateDirectoryStructureText remain the same
     function buildFileTreeData(files) { const tree = {}; files.sort((a, b) => a.path.localeCompare(b.path)).forEach(file => { const pathParts = file.path.split('/'); let currentLevel = tree; pathParts.forEach((part, index) => { if (!part) return; if (index === pathParts.length - 1) { currentLevel[part] = { type: 'file' }; } else { if (!currentLevel[part] || currentLevel[part].type === 'file') { currentLevel[part] = { type: 'dir', children: {} }; } currentLevel = currentLevel[part].children; } }); }); return tree; }
     function generateDirectoryStructureText(files, rootDirName = 'repository') { if (!files || files.length === 0) return `└── ${rootDirName}/\n    (No processable files found)\n`; const treeData = buildFileTreeData(files); let structure = `└── ${rootDirName}/\n`; function renderTextNode(nodes, prefix) { const keys = Object.keys(nodes).sort(); keys.forEach((key, index) => { const node = nodes[key]; const isLast = index === keys.length - 1; const connector = isLast ? '└── ' : '├── '; structure += prefix + connector + key + (node.type === 'dir' ? '/' : '') + '\n'; if (node.type === 'dir' && node.children && Object.keys(node.children).length > 0) { const childPrefix = prefix + (isLast ? '    ' : '│   '); renderTextNode(node.children, childPrefix); } }); } renderTextNode(treeData, '    '); return structure; }


    // --- Download Functionality ---
    function handleDownloadTxt() {
        if (!fullCombinedOutput) {
            setStatus('No output content to download.', 'warning', 'download');
            return;
        }
        setStatus('💾 Preparing download...', 'info', 'download');
        try {
            const blob = new Blob([fullCombinedOutput], { type: 'text/plain;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const filenameSafeRepoName = currentRepoName.replace(/[\/\\]+/g, '_') || 'codebase';
            link.download = `${filenameSafeRepoName}_ingest.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            setStatus('✅ Download ready.', 'success', 'download');
            setTimeout(() => setStatus('', 'info', 'download'), 3000);
        } catch (error) {
            console.error("Download error:", error);
            setStatus(`❌ Download failed: ${error.message}`, 'error', 'download');
        }
    }

    // --- Copy Functionality ---
    function copyToClipboard(textToCopy, buttonElement, contentTypeLabel = 'Output') {
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                const originalButtonHTML = buttonElement.innerHTML;
                buttonElement.innerHTML = `<span class="icon">✅</span> Copied!`;
                buttonElement.classList.add('copied');
                buttonElement.disabled = true; // Briefly disable after copy
                setTimeout(() => {
                    buttonElement.innerHTML = originalButtonHTML;
                    buttonElement.classList.remove('copied');
                    buttonElement.disabled = false; // Re-enable
                }, 2000);
            })
            .catch(err => {
                console.error(`Copy failed for ${contentTypeLabel}: `, err);
                setStatus(`❌ Copy failed. See console.`, 'error', 'final'); // Use main status for copy errors
                alert(`Automatic copy failed. Please copy manually.`);
            });
    }

    // --- Utility Functions (Keep essential ones) ---
     function parseUserPatterns(patternsString) { if (!patternsString) return []; return patternsString.split(',').map(p => p.trim()).filter(p => p); }
     function parseGitignore(content) { if (!content) return []; return content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')); }
     function shouldProcessFile(relativePath, fileSize, fileName) { if (!relativePath || relativePath === '.git') return false; for (const { pattern, isDir } of ALWAYS_IGNORE_PATTERNS) { if (matchesSimplePattern(relativePath, pattern, isDir)) return false; } if (fileSize > currentMaxSizeBytes) return false; if (isLikelyBinaryByExtension(fileName)) return false; const userPatterns = parseUserPatterns(filterPatternsInput.value); const filterMode = filterModeSelect.value; let matchesUserPattern = false; if (userPatterns.length > 0) { matchesUserPattern = userPatterns.some(p => matchesSimplePattern(relativePath, p)); } if (filterMode === 'Include') { if (userPatterns.length > 0 && !matchesUserPattern) return false; } else { if (userPatterns.length > 0 && matchesUserPattern) return false; } if (relativePath.endsWith('/.gitignore') || relativePath === '.gitignore') { if(filterMode === 'Exclude' && matchesUserPattern) return false; return true; } for (const rule of gitignoreRules) { const trimmedRule = rule.trim(); if (!trimmedRule || trimmedRule.startsWith('#') || trimmedRule.startsWith('!')) continue; if (matchesSimplePattern(relativePath, trimmedRule)) return false; } return true; }
     function isLikelyBinaryByExtension(filename) { if (!filename) return false; const lowerFilename = filename.toLowerCase(); const lastDotIndex = lowerFilename.lastIndexOf('.'); if (lastDotIndex < 1 || lastDotIndex === lowerFilename.length - 1) return BINARY_EXTENSIONS.has(lowerFilename); const extension = lowerFilename.substring(lastDotIndex); return BINARY_EXTENSIONS.has(extension); }
     function matchesSimplePattern(path, pattern, isDirPattern = pattern.endsWith('/')) { const normalizedPath = path.replace(/\\/g, '/'); pattern = pattern.trim(); if (isDirPattern) { const dirPattern = pattern.slice(0, -1); return normalizedPath === dirPattern || normalizedPath.startsWith(dirPattern + '/'); } if (pattern.startsWith('/')) { pattern = pattern.substring(1); if (pattern.includes('*')) { const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*'); try { return new RegExp(regexPattern).test(normalizedPath); } catch (e) { return false; } } else { return normalizedPath === pattern || normalizedPath.startsWith(pattern + '/'); } } if (pattern.includes('/')) { if (pattern.includes('*')) { const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*'); try { return new RegExp(regexPattern).test(normalizedPath); } catch (e) { return false; } } else { return ('/' + normalizedPath).includes('/' + pattern); } } if (!pattern.includes('/')) { const pathSegments = normalizedPath.split('/'); if (pattern.includes('*')) { const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'; try { const regex = new RegExp(regexPattern); return pathSegments.some(segment => regex.test(segment)); } catch (e) { return false; } } else { return pathSegments.some(segment => segment === pattern); } } return false; }
     function formatSize(bytes) { if (bytes < 0) bytes = 0; if (bytes === 0) return '0 Bytes'; const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; if (bytes < k) return bytes + ' Bytes'; const i = Math.floor(Math.log(bytes) / Math.log(k)); let size = parseFloat((bytes / Math.pow(k, i)).toFixed(i < 2 ? 0 : 1)); if (size >= k && i < sizes.length - 1) { size = parseFloat((bytes / Math.pow(k, i + 1)).toFixed(1)); return `${size} ${sizes[i + 1]}`; } return `${size} ${sizes[i]}`; }
     function readFileContentLocal(file, sizeLimitOverride = null) { return new Promise((resolve, reject) => { const sizeLimit = sizeLimitOverride !== null ? sizeLimitOverride : currentMaxSizeBytes; if (file.size > sizeLimit) return reject(new Error(`Size (${formatSize(file.size)}) > limit (${formatSize(sizeLimit)})`)); if (file.size === 0) return resolve(""); const reader = new FileReader(); reader.onload = (event) => { const text = event.target.result; if (text && text.indexOf('\u0000') !== -1) reject(new Error(`Null byte detected: ${file.name}`)); else resolve(text); }; reader.onerror = (event) => reject(new Error(`Read error: ${reader.error?.message || 'Unknown error'}`)); reader.readAsText(file); }); }
     async function fetchRepoContentsRecursive(owner, repo, path = '', accumulatedFiles = []) { const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`; const response = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' }, cache: 'no-cache' }); if (!response.ok) { let errorMsg = `API Error (${response.status}) path "/${path}".`; try { const d = await response.json(); errorMsg = `API Error: ${d.message||response.statusText} path "/${path}"`; } catch(e){} if (response.status === 404) errorMsg = `Not found: ${owner}/${repo}/${path}`; if (response.status === 403) {const r=response.headers.get('X-RateLimit-Remaining'); if(r&&parseInt(r)===0){const t=new Date(parseInt(response.headers.get('X-RateLimit-Reset'))*1000);errorMsg=`Rate limit exceeded. Try after ${t.toLocaleTimeString()}.`;}else{errorMsg=`Access denied for ${owner}/${repo}/${path}.`;}} throw new Error(errorMsg); } const items = await response.json(); if (!Array.isArray(items)) { if(items.type==='file'||items.type==='dir'){accumulatedFiles.push({path:items.path,size:items.size,sha:items.sha,type:items.type,url:items.url}); if(items.type==='dir')await fetchRepoContentsRecursive(owner,repo,items.path,accumulatedFiles); return accumulatedFiles;}else{throw new Error(`Unexpected API response path "${path}".`);}} const directoryPromises = []; for (const item of items) { accumulatedFiles.push({ path: item.path, size: item.size, sha: item.sha, type: item.type, url: item.url }); if (item.type === 'dir') directoryPromises.push(fetchRepoContentsRecursive(owner, repo, item.path, accumulatedFiles)); } await Promise.all(directoryPromises); return accumulatedFiles; }
     async function fetchFileContentFromAPI(owner, repo, filePath, fileSize) { if (fileSize > GITHUB_API_MAX_FILE_SIZE_BYTES) throw new Error(`File size (${formatSize(fileSize)}) > API limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`); if (fileSize === 0) return ""; const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`; const response = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3.raw' }, cache: 'no-cache' }); if (!response.ok) { let errorMsg = `API fetch error (${response.status}) "${filePath}".`; if (response.status === 403) errorMsg = `Access denied/rate limit fetching "${filePath}".`; try { const jsonResponse = await fetch(apiUrl.replace('.raw', '+json')); if (jsonResponse.ok) { const d = await jsonResponse.json(); if (d.encoding === 'base64' && d.content) { if (d.size > GITHUB_API_MAX_FILE_SIZE_BYTES) throw new Error(`File size (${formatSize(d.size)}) > API limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`); try { const c = atob(d.content); if (c.indexOf('\u0000') !== -1) throw new Error(`Null byte detected (base64): ${filePath}`); return c; } catch (e) { throw new Error(`Base64 decode failed: ${e.message}`); } } } } catch (e) { /* ignore fallback */ } throw new Error(errorMsg); } const content = await response.text(); if (content && content.indexOf('\u0000') !== -1) throw new Error(`Null byte detected (raw): ${filePath}`); return content; }
     async function processPromisesBatch(promises, batchSize, progressCallback) { let results = []; let index = 0; while (index < promises.length) { const batch = promises.slice(index, index + batchSize); const batchResults = await Promise.all(batch); results = results.concat(batchResults); index += batch.length; if (progressCallback) progressCallback(index, promises.length); const delay = (currentInputMode === 'url' && index < promises.length) ? 50 : 1; await new Promise(resolve => setTimeout(resolve, delay)); } return results; }
     function parseGitHubUrl(url) { try { const u = new URL(url); if (u.hostname !== 'github.com') return null; const p = u.pathname.split('/').filter(Boolean); if (p.length < 2) return null; const [owner, repo] = p; const r = repo.endsWith('.git') ? repo.slice(0, -4) : repo; return { owner, repo: r }; } catch (e) { return null; } }

}); // End DOMContentLoaded