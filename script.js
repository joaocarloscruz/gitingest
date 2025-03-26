document.addEventListener('DOMContentLoaded', () => {
    // --- Existing UI Elements ---
    const folderInput = document.getElementById('folderInput');
    const statusDisplay = document.getElementById('status');
    const outputArea = document.getElementById('output');
    const copyButton = document.getElementById('copyButton');
    const filterModeSelect = document.getElementById('filterMode');
    const filterPatternsInput = document.getElementById('filterPatterns');
    const maxSizeSlider = document.getElementById('maxSizeSlider');
    const maxSizeValueDisplay = document.getElementById('maxSizeValue');

    // --- NEW UI Elements ---
    const directoryOutputArea = document.getElementById('directoryOutput');
    const copyStructureButton = document.getElementById('copyStructureButton');
    // --- End New UI Elements ---

    // --- Configuration ---
    let currentMaxSizeBytes = parseInt(maxSizeSlider.value) * 1024;
    const BINARY_EXTENSIONS = new Set([ /* ... (keep existing set) ... */
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.exe', '.dll', '.so', '.dylib', '.app', '.dmg', '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.webm', '.class', '.jar', '.pyc', '.pyd', '.lock', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.eot']);
    const ALWAYS_IGNORE_PATTERNS = [ /* ... (keep existing array) ... */
         '.git/', 'node_modules/', 'dist/', 'build/', 'coverage/', '__pycache__/', '*.pyc', '.DS_Store', 'Thumbs.db'].map(p => ({ pattern: p, isDir: p.endsWith('/') }));

    // --- State Variables ---
    let gitignoreRules = [];
    let userFilterPatterns = [];
    let currentFilterMode = filterModeSelect.value;
    let processedFilePaths = []; // Store paths for the directory tree
    let rootFolderName = ''; // Store the name of the selected folder

    // --- Event Listeners ---
    folderInput.addEventListener('change', handleFolderSelect);
    copyButton.addEventListener('click', () => copyTextToClipboard(outputArea.value, copyButton, statusDisplay, "Output copied to clipboard!", "Failed to copy output."));
    copyStructureButton.addEventListener('click', () => copyTextToClipboard(directoryOutputArea.value, copyStructureButton, statusDisplay, "Directory structure copied!", "Failed to copy structure.")); // Use helper

    maxSizeSlider.addEventListener('input', () => { /* ... (keep existing logic) ... */
        const kbValue = parseInt(maxSizeSlider.value);
        currentMaxSizeBytes = kbValue * 1024;
        maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
        const percentage = (kbValue / parseInt(maxSizeSlider.max)) * 100;
        maxSizeSlider.style.setProperty('--value-percent', `${percentage}%`);
    });
    filterModeSelect.addEventListener('change', () => { currentFilterMode = filterModeSelect.value; });

    // --- Initial Setup ---
    maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
    const initialPercentage = (parseInt(maxSizeSlider.value) / parseInt(maxSizeSlider.max)) * 100;
    maxSizeSlider.style.setProperty('--value-percent', `${initialPercentage}%`);


    // --- Core Logic ---

    async function handleFolderSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            statusDisplay.textContent = 'No folder selected or folder is empty.';
            outputArea.value = '';
            directoryOutputArea.value = ''; // Clear structure output
            copyButton.disabled = true;
            copyStructureButton.disabled = true; // Disable structure copy
            return;
        }

        // Reset state
        statusDisplay.textContent = `Preparing... Reading filters...`;
        outputArea.value = 'Processing... Please wait.\n';
        directoryOutputArea.value = ''; // Clear previous structure
        copyButton.disabled = true;
        copyStructureButton.disabled = true;
        gitignoreRules = [];
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
        currentFilterMode = filterModeSelect.value;
        processedFilePaths = []; // Reset paths for tree
        rootFolderName = files[0]?.webkitRelativePath.split('/')[0] || 'selected-folder'; // Get root folder name

        // Sort files (process .gitignore first)
        const sortedFiles = Array.from(files).sort((a, b) => { /* ... (keep existing sort) ... */
             if (a.webkitRelativePath.endsWith('/.gitignore')) return -1;
            if (b.webkitRelativePath.endsWith('/.gitignore')) return 1;
            return a.webkitRelativePath.localeCompare(b.webkitRelativePath);
         });

        // Read .gitignore
        const gitignoreFile = sortedFiles.find(f => f.webkitRelativePath.split('/').length === 2 && f.name === '.gitignore');
        if (gitignoreFile) {
            try {
                statusDisplay.textContent = 'Reading .gitignore...';
                const gitignoreContent = await readFileContent(gitignoreFile, true);
                gitignoreRules = parseGitignore(gitignoreContent);
                statusDisplay.textContent = `Found ${gitignoreRules.length} rules in .gitignore. Processing files...`;
            } catch (error) {
                console.error("Error reading .gitignore:", error);
                statusDisplay.textContent = 'Could not read .gitignore. Processing files...';
            }
        } else {
             statusDisplay.textContent = 'No .gitignore found at root. Processing files...';
        }
        await new Promise(resolve => setTimeout(resolve, 0)); // UI update

        // --- Filter files and collect paths for tree ---
        let ignoredFileCount = 0;
        const totalFiles = sortedFiles.length;
        const fileProcessingPromises = [];

        statusDisplay.textContent = `Analyzing ${totalFiles} items for structure and content...`;
        await new Promise(resolve => setTimeout(resolve, 0));

        for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            const filePath = file.webkitRelativePath;
            const relativePathInRepo = filePath.substring(filePath.indexOf('/') + 1);

            if (shouldProcessFile(relativePathInRepo, file.size, file.name)) {
                processedFilePaths.push(relativePathInRepo); // Add path for the tree
                fileProcessingPromises.push(
                    readFileContent(file)
                        .then(content => ({ path: relativePathInRepo, content: content }))
                        .catch(error => {
                            console.warn(`Skipping content of ${relativePathInRepo}: ${error.message}`);
                            // Don't increment ignoredFileCount here, it's counted below if read fails
                            return null; // Mark as failed read
                        })
                );
            } else {
                ignoredFileCount++;
            }

            if (i % 100 === 0 || i === totalFiles - 1) {
                 statusDisplay.textContent = `Analyzing item ${i + 1}/${totalFiles}... (Included so far: ${processedFilePaths.length})`;
                 await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // --- Generate and Display Directory Tree ---
        statusDisplay.textContent = "Generating directory structure...";
        await new Promise(resolve => setTimeout(resolve, 0));
        let directoryStructure = '';
        if (processedFilePaths.length > 0) {
            try {
                 directoryStructure = generateDirectoryTree(processedFilePaths, rootFolderName);
                 directoryOutputArea.value = directoryStructure;
                 copyStructureButton.disabled = false;
            } catch(e) {
                 console.error("Error generating directory tree:", e);
                 directoryOutputArea.value = "Error generating directory structure.";
                 copyStructureButton.disabled = true;
            }
        } else {
            directoryOutputArea.value = "No files included based on filters.";
            copyStructureButton.disabled = true;
        }


        // --- Read File Contents Concurrently ---
        statusDisplay.textContent = `Reading content of ${fileProcessingPromises.length} files...`;
        await new Promise(resolve => setTimeout(resolve, 0));

        const results = await processPromisesBatch(fileProcessingPromises, 10, (done, total) => {
            statusDisplay.textContent = `Reading file content ${done}/${total}...`;
        });

        // --- Combine results for main output ---
        let combinedOutput = '';
        let processedFileCount = 0; // Count successful reads
        results.forEach(result => {
            if (result && result.content !== null) {
                combinedOutput += `--- FILENAME: ${result.path} ---\n`;
                combinedOutput += result.content;
                combinedOutput += '\n\n';
                processedFileCount++;
            } else if (result === null) {
                 ignoredFileCount++; // Increment ignore count for files that failed reading
            }
        });
        // Adjust ignored count - it's total minus successfully read files
        ignoredFileCount = totalFiles - processedFileCount;

        outputArea.value = combinedOutput;
        statusDisplay.textContent = `Done. Displayed structure for ${processedFilePaths.length} items. Processed content of ${processedFileCount} files. Ignored ${ignoredFileCount} items. Total items: ${totalFiles}.`;
        copyButton.disabled = combinedOutput.length === 0;

        folderInput.value = null;
    }

    // --- Directory Tree Generation ---
    function generateDirectoryTree(paths, rootName = 'root') {
        if (!paths || paths.length === 0) return '';

        const tree = { __isDirectory: true, __children: {} }; // Use __children to store nodes

        // Build the intermediate tree structure
        paths.forEach(path => {
            const parts = path.split('/').filter(p => p); // Filter empty parts
            let currentLevel = tree.__children;
            let currentPath = '';

            parts.forEach((part, index) => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const isLastPart = index === parts.length - 1;

                if (!currentLevel[part]) {
                    currentLevel[part] = {
                        __isDirectory: !isLastPart, // It's a directory if it's not the last part
                        __children: {}
                    };
                } else {
                     // If an entry exists, make sure it's marked as a directory if it's not the last part
                     if (!isLastPart) {
                         currentLevel[part].__isDirectory = true;
                     }
                }


                if (!isLastPart) {
                    currentLevel = currentLevel[part].__children;
                }
            });
        });

        // Recursive function to format the tree string
        function formatNode(node, indent = '', isLast = true) {
            let output = '';
            const children = node.__children;
            const keys = Object.keys(children).sort(); // Sort entries alphabetically
            const prefix = indent + (isLast ? '└── ' : '├── ');
            const childIndent = indent + (isLast ? '    ' : '│   ');

            keys.forEach((key, index) => {
                const childNode = children[key];
                const isChildLast = index === keys.length - 1;
                output += prefix + key + (childNode.__isDirectory ? '/' : '') + '\n';
                if (childNode.__isDirectory && Object.keys(childNode.__children).length > 0) {
                    output += formatNode(childNode, childIndent, isChildLast);
                }
            });
            // Remove trailing newline from the recursive calls within this level
             // output = output.trimEnd(); // Be careful this doesn't remove needed newlines between items
             return output; // Output already includes newlines
        }

        // Start formatting from the root
        let treeString = `Directory structure:\n`;
        treeString += `└── ${rootName}/\n`; // Add the root folder name
        treeString += formatNode({ __children: tree.__children, __isDirectory: true }, '    ', true); // Start indent for root children

        return treeString.trimEnd(); // Remove final trailing newline
    }


    // --- Helper Functions (Keep existing ones) ---
    async function processPromisesBatch(promises, batchSize, progressCallback) { /* ... keep ... */
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
             await new Promise(resolve => setTimeout(resolve, 0)); // Yield
        }
        return results;
    }

    function readFileContent(file, ignoreSizeLimit = false) { /* ... keep ... */
         return new Promise((resolve, reject) => {
            if (!ignoreSizeLimit && file.size > currentMaxSizeBytes) {
                return reject(new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit of ${formatSize(currentMaxSizeBytes)}`));
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target.result && event.target.result.includes('\u0000')) {
                    reject(new Error(`Detected null byte, likely a binary file: ${file.name}`));
                } else {
                    resolve(event.target.result);
                }
            };
            reader.onerror = (event) => {
                reject(new Error(`Error reading file ${file.name}: ${reader.error}`));
            };
            reader.readAsText(file);
        });
    }
    function parseUserPatterns(patternsString) { /* ... keep ... */
         if (!patternsString) return [];
        return patternsString.split(',').map(p => p.trim()).filter(p => p);
    }
    function parseGitignore(content) { /* ... keep ... */
         if (!content) return [];
        return content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    }
    function shouldProcessFile(relativePath, fileSize, fileName) { /* ... keep ... */
         // 1. Always Ignore
        for (const { pattern, isDir } of ALWAYS_IGNORE_PATTERNS) {
            if (matchesSimplePattern(relativePath, pattern, isDir)) return false;
        }
        // 2. Size
        if (fileSize > currentMaxSizeBytes) return false;
        // 3. Binary Extension
        if (isLikelyBinaryByExtension(fileName)) return false;
        // 4. User Filter
        const matchesUserPattern = userFilterPatterns.length > 0 && userFilterPatterns.some(p => matchesSimplePattern(relativePath, p));
        if (currentFilterMode === 'Include') {
            if (userFilterPatterns.length > 0 && !matchesUserPattern) return false;
        } else { // Exclude
            if (matchesUserPattern) return false;
        }
        // 5. Gitignore
        if (relativePath !== '.gitignore') { // Don't ignore the root .gitignore itself
             for (const rule of gitignoreRules) {
                if (matchesSimplePattern(relativePath, rule)) return false;
             }
        }
        // 6. Process if not ignored
        return true;
     }
    function isLikelyBinaryByExtension(filename) { /* ... keep ... */
         const lowerFilename = filename.toLowerCase();
        for (const ext of BINARY_EXTENSIONS) {
            if (lowerFilename.endsWith(ext)) return true;
        }
        return false;
    }
    function matchesSimplePattern(path, pattern, isDirPattern = pattern.endsWith('/')) { /* ... keep ... */
         if (isDirPattern) {
            const dirPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
            return path === dirPattern || path.startsWith(dirPattern + '/');
        } else if (pattern.startsWith('*') && !pattern.includes('/')) {
            return path.endsWith(pattern.slice(1));
        } else if (pattern.endsWith('*') && !pattern.includes('/')) {
             const filename = path.split('/').pop();
             return filename.startsWith(pattern.slice(0, -1));
        } else if (!pattern.includes('*') && !pattern.includes('/')) {
             return path.split('/').pop() === pattern;
        } else {
             if (pattern.endsWith('*')) {
                 const prefix = pattern.slice(0, -1);
                 return path.startsWith(prefix);
             } else {
                return path === pattern || path.startsWith(pattern + '/');
             }
        }
    }
    function formatSize(bytes) { /* ... keep ... */
        if (bytes === 0) return '0 KB';
        const kb = bytes / 1024;
        if (kb < 1024) {
            return `${kb.toFixed(0)} KB`;
        } else {
            return `${(kb / 1024).toFixed(1)} MB`;
        }
    }

    // --- NEW Reusable Copy Helper ---
    function copyTextToClipboard(text, buttonElement, statusElement, successMessage, errorMessage) {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => {
                const originalStatus = statusElement.textContent;
                const originalButtonText = buttonElement.innerHTML; // Store full HTML content
                statusElement.textContent = successMessage;
                buttonElement.innerHTML = 'Copied!'; // Simple text feedback
                buttonElement.disabled = true; // Briefly disable

                setTimeout(() => {
                    buttonElement.innerHTML = originalButtonText; // Restore original HTML
                    statusElement.textContent = originalStatus;
                    buttonElement.disabled = false; // Re-enable
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                statusElement.textContent = errorMessage + ' See console.';
                // Optionally alert user
                // alert('Could not copy text. You might need to grant clipboard permissions or copy manually.');
            });
    }

    // --- Initialize ---
    maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);

});
