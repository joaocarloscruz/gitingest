document.addEventListener('DOMContentLoaded', () = >{
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
  const finalStatusDisplay = document.getElementById('finalStatus');

  const resultsContainer = document.getElementById('resultsContainer');
  const repoNameDisplay = document.getElementById('repoName');
  const filesCountDisplay = document.getElementById('filesCount');
  const downloadTxtButton = document.getElementById('downloadTxtButton');
  const copyAllButton = document.getElementById('copyAllButton');
  const downloadStatusDisplay = document.getElementById('downloadStatus');
  const copyStructureButton = document.getElementById('copyStructureButton');
  const structureOutput = document.getElementById('structureOutput').querySelector('code'); // Target code element
  const copyContentButton = document.getElementById('copyContentButton');
  const contentOutput = document.getElementById('contentOutput').querySelector('code'); // Target code element
  const contentNotice = document.getElementById('contentNotice');

  // --- State Variables ---
  let currentMaxSizeBytes = parseInt(maxSizeSlider.value) * 1024;
  let currentInputMode = 'local';
  let gitignoreRules = [];
  let userFilterPatterns = [];
  let currentFilterMode = filterModeSelect.value;
  let processedFilesData = []; // Stores { path: string, content: string, size: number }
  let currentRepoName = 'N/A';
  let fullStructureText = ''; // Store full structure text
  let fullContentText = ''; // Store full combined content text
  let displayedContentText = ''; // Store potentially cropped content text

  // --- Constants ---
  const GITHUB_API_MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;
  const MAX_DISPLAY_CHARS = 300 * 1024; // 300k character limit for display area
  const STRUCTURE_HEADER = "Directory structure:\n";
  const CONTENT_HEADER = "================================================\nFILE CONTENT:\n================================================\n\n";
  const COMBINED_SEPARATOR = "\n\n\n" + CONTENT_HEADER; // Separator for Copy All / Download

  // (Keep BINARY_EXTENSIONS and ALWAYS_IGNORE_PATTERNS as before)
  const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.iso', '.dmg', '.exe', '.dll', '.so', '.dylib', '.app', '.bin', '.msi', '.mp3', '.wav', '.ogg', '.flac', '.aac', '.mp4', '.avi', '.mov', '.webm', '.mkv', '.wmv', '.class', '.jar', '.pyc', '.pyd', '.lock', '.lockb', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.sqlite', '.db', '.mdb', '.DS_Store', 'Thumbs.db']);
  const ALWAYS_IGNORE_PATTERNS = ['.git/', '.svn/', '.hg/', 'node_modules/', 'bower_components/', 'vendor/', 'dist/', 'build/', 'out/', 'target/', 'coverage/', '__pycache__/', '*.pyc', '.DS_Store', 'Thumbs.db', '.env', '.idea/', '.vscode/', '*.log', '*.tmp', '*.temp', 'package-lock.json', 'yarn.lock'].map(p = >({
    pattern: p,
    isDir: p.endsWith('/')
  }));

  // --- Event Listeners ---
  modeLocalRadio.addEventListener('change', handleModeChange);
  modeUrlRadio.addEventListener('change', handleModeChange);
  folderInput.addEventListener('change', handleFolderSelect);
  fetchUrlButton.addEventListener('click', handleUrlFetch);
  maxSizeSlider.addEventListener('input', updateMaxSize);
  filterModeSelect.addEventListener('change', () = >{
    currentFilterMode = filterModeSelect.value;
  });
  filterPatternsInput.addEventListener('input', () = >{
    userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
  });
  copyStructureButton.addEventListener('click', () = >copyToClipboard(fullStructureText, copyStructureButton, 'Structure'));
  copyContentButton.addEventListener('click', () = >copyToClipboard(displayedContentText, copyContentButton, 'Displayed Content'));
  copyAllButton.addEventListener('click', () = >copyToClipboard(fullStructureText + COMBINED_SEPARATOR + fullContentText, copyAllButton, 'All Output'));
  downloadTxtButton.addEventListener('click', handleDownloadTxt);

  // --- Initial Setup ---
  handleModeChange();
  updateMaxSize();
  resetUIState();

  // --- UI State Management ---
  function resetUIState(clearInputs = false) {
    resultsContainer.style.display = 'none'; // Hide results initially
    repoNameDisplay.textContent = 'N/A';
    filesCountDisplay.textContent = '0';
    structureOutput.textContent = '';
    contentOutput.textContent = '';
    contentNotice.style.display = 'none';
    finalStatusDisplay.textContent = '';
    finalStatusDisplay.className = 'status-text';
    downloadStatusDisplay.textContent = '';
    downloadStatusDisplay.className = 'status-text';

    processedFilesData = [];
    fullStructureText = '';
    fullContentText = '';
    displayedContentText = '';
    currentRepoName = 'N/A';

    // Disable all action/copy buttons
    [downloadTxtButton, copyAllButton, copyStructureButton, copyContentButton].forEach(btn = >btn.disabled = true);

    if (clearInputs) {
      folderInput.value = null;
      urlInput.value = '';
      localStatusDisplay.textContent = 'No folder selected.';
      urlStatusDisplay.textContent = 'Enter public GitHub URL.';
    }
  }

  function handleModeChange() {
    currentInputMode = document.querySelector('input[name="inputMode"]:checked').value;
    resetUIState(true); // Clear everything

    if (currentInputMode === 'local') {
      localModeSection.style.display = 'flex'; // Use flex for alignment
      urlModeSection.style.display = 'none';
    } else { // url mode
      localModeSection.style.display = 'none';
      urlModeSection.style.display = 'flex'; // Use flex for alignment
    }
  }

  function updateMaxSize() {
    // ... (same as before)
    const kbValue = parseInt(maxSizeSlider.value);
    currentMaxSizeBytes = kbValue * 1024;
    maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
    updateSliderBackground();
  }
  function updateSliderBackground() {
    // ... (same as before)
    const percentage = (parseInt(maxSizeSlider.value) / parseInt(maxSizeSlider.max)) * 100;
    maxSizeSlider.style.setProperty('--value-percent', `$ {
      percentage
    } % `);
  }

  function setStatus(message, type = 'info', target = 'final') {
    // ... (same as before, targets 'local', 'url', 'download', 'final')
    let displayElement;
    let isError = (type === 'error');
    let isWarning = (type === 'warning');
    let isSuccess = (type === 'success');

    switch (target) {
    case 'local':
      displayElement = localStatusDisplay;
      break;
    case 'url':
      displayElement = urlStatusDisplay;
      break;
    case 'download':
      displayElement = downloadStatusDisplay;
      break;
    case 'final':
      displayElement = finalStatusDisplay;
      break;
    default:
      displayElement = finalStatusDisplay;
    }

    if (displayElement) {
      displayElement.textContent = message;
      displayElement.style.color = ''; // Reset color
      displayElement.className = 'status-text'; // Reset class

      let color = 'var(--color-secondary)';
      let statusClass = '';
      if (isError) {
        color = 'var(--color-danger)';
        statusClass = 'status-error';
      } else if (isWarning) {
        color = 'var(--color-warning)';
        statusClass = 'status-warning';
      } else if (isSuccess) {
        color = 'var(--color-success)';
        statusClass = 'status-success';
      }

      displayElement.style.color = color;
      if (statusClass) { // Apply class if defined
        displayElement.classList.add(statusClass);
      }
    }
    if (message && target === 'final') { // Also log final status
      if (isError) console.error(message);
      else if (isWarning) console.warn(message);
      else console.log(message);
    }
  }

  function setUIDisabled(isDisabled) {
    // Disable inputs/filters
    [modeLocalRadio, modeUrlRadio, urlInput, fetchUrlButton, filterModeSelect, filterPatternsInput, maxSizeSlider].forEach(el = >el.disabled = isDisabled);
    document.querySelector('label[for="folderInput"]').style.pointerEvents = isDisabled ? 'none': 'auto';
    document.querySelector('label[for="folderInput"]').style.opacity = isDisabled ? '0.65': '1';

    // Buttons are handled separately based on data availability
    if (isDisabled) { [downloadTxtButton, copyAllButton, copyStructureButton, copyContentButton].forEach(btn = >btn.disabled = true);
    }
  }

  // --- Core Processing Logic (Common for Local/URL) ---
  async
  function processFiles(fileFetchFunction) {
    resetUIState();
    const modeStatusTarget = currentInputMode === 'local' ? 'local': 'url';
    setStatus(`⏳Preparing...`, 'info', modeStatusTarget);
    setUIDisabled(true);

    gitignoreRules = [];
    userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
    currentFilterMode = filterModeSelect.value;
    processedFilesData = []; // Reset processed data

    try {
      const {
        filesToProcess,
        totalItems,
        repoName
      } = await fileFetchFunction();
      currentRepoName = repoName;

      if (filesToProcess.length === 0 && totalItems === 0) {
        setStatus(`✅No items found or folder empty.`, 'warning', 'final');
        setUIDisabled(false);
        return;
      }

      // --- Read .gitignore ---
      const gitignoreFile = filesToProcess.find(f = >f.isGitignore);
      if (gitignoreFile) {
        try {
          setStatus(`⏳Reading.gitignore...`, 'info', modeStatusTarget);
          const gitignoreContent = await gitignoreFile.read();
          gitignoreRules = parseGitignore(gitignoreContent);
          setStatus(`ℹ️Parsed $ {
            gitignoreRules.length
          }
          rules from.gitignore.`, 'info', modeStatusTarget);
        } catch(error) {
          setStatus(`⚠️Could not read.gitignore: $ {
            error.message
          }.`, 'warning', modeStatusTarget);
        }
        await new Promise(resolve = >setTimeout(resolve, 20)); // UI update
      } else {
        setStatus(`ℹ️No root.gitignore found.`, 'info', modeStatusTarget);
      }

      // --- Filter and Prepare Read Promises ---
      let ignoredCount = 0;
      let readErrorCount = 0;
      let skippedApiLimitCount = 0; // URL mode specific
      const fileProcessingPromises = [];

      setStatus(`🔎Analyzing $ {
        totalItems
      }
      items...`, 'info', modeStatusTarget);
      await new Promise(resolve = >setTimeout(resolve, 0));

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];

        // Skip gitignore now as it's processed
        if (file.isGitignore) {
          // If it passed shouldProcess initially, we still count it, but don't read again
          // ignoredCount++; // Don't double count if it failed shouldProcess earlier
          continue;
        }

        // Check API limit for URL mode (already done during list fetch, but double check)
        if (currentInputMode === 'url' && file.size > GITHUB_API_MAX_FILE_SIZE_BYTES) {
          console.warn(`Skipping $ {
            file.path
          }: Size($ {
            formatSize(file.size)
          }) exceeds GitHub API content limit.`);
          skippedApiLimitCount++;
          ignoredCount++;
          continue;
        }

        // Apply filtering rules (shouldProcessFile implicitly handles size, binary, patterns, gitignore)
        if (!shouldProcessFile(file.path, file.size, file.name)) {
          ignoredCount++;
          continue;
        }

        fileProcessingPromises.push(file.read() // Use the file object's read method
        .then(content = >({
          path: file.path,
          content: content,
          size: file.size
        })).
        catch(error = >{
          console.warn(`Skipping file $ {
            file.path
          }: $ {
            error.message
          }`);
          return {
            path: file.path,
            content: null,
            error: true,
            size: file.size
          };
        }));

        if (i % 100 === 0 || i === filesToProcess.length - 1) {
          setStatus(`🔎Analyzing item $ {
            i + 1
          }
          /${totalItems}... (Filtered: ${ignoredCount})`, 'info', modeStatusTarget);
                     await new Promise(resolve => setTimeout(resolve, 0));
                 }
             }

             / / ---Read File Contents---const filesToReadCount = fileProcessingPromises.length; setStatus(`📚Reading $ {
            filesToReadCount
          }
          filtered files...`, 'info', modeStatusTarget); await new Promise(resolve = >setTimeout(resolve, 0));

          // Adjust batch size based on mode
          const batchSize = currentInputMode === 'local' ? 15 : 5; const results = await processPromisesBatch(fileProcessingPromises, batchSize, (done, total) = >{
            setStatus(`📚Reading file $ {
              done
            }
            /${total}...`, 'info', modeStatusTarget);
             });

             / / ---Process Results---let processedFileCount = 0; processedFilesData = []; // Ensure it's clean
            results.forEach(result = >{
              if (result && result.content !== null) {
                processedFilesData.push({
                  path: result.path,
                  content: result.content,
                  size: result.size
                });
                processedFileCount++;
              } else if (result && result.error) {
                readErrorCount++;
              }
            });

            // Recalculate ignored count accurately based on final processed/error files
            ignoredCount = totalItems - processedFileCount - readErrorCount - (gitignoreFile ? 1 : 0); // Adjust for gitignore if present
            // Ensure ignoredCount isn't negative if totalItems was inaccurate (e.g., only dirs listed)
            ignoredCount = Math.max(0, ignoredCount - skippedApiLimitCount); // Subtract API skips as they are also errors/ignored

            // --- Generate and Display Output ---
            if (processedFileCount > 0) {
              setStatus('🌲 Generating structure...', 'info', modeStatusTarget);
              await new Promise(resolve = >setTimeout(resolve, 0));
              fullStructureText = generateDirectoryStructureText(processedFilesData, currentRepoName);
              structureOutput.textContent = fullStructureText; // Display structure

              setStatus('📝 Combining content...', 'info', modeStatusTarget);
              await new Promise(resolve = >setTimeout(resolve, 0));
              fullContentText = ''; // Reset before combining
              processedFilesData.forEach(file = >{
                fullContentText += `---FILENAME: $ {
                  file.path
                }---\n`;
                fullContentText += file.content + '\n\n';
              });

              // Crop content for display if necessary
              let cropped = false;
              if (fullContentText.length > MAX_DISPLAY_CHARS) {
                displayedContentText = fullContentText.substring(0, MAX_DISPLAY_CHARS) + "\n\n[...]";
                cropped = true;
              } else {
                displayedContentText = fullContentText;
              }
              contentOutput.textContent = displayedContentText;
              contentNotice.style.display = cropped ? 'block': 'none';

              resultsContainer.style.display = 'flex'; // Show results section
            } else {
              // No files processed, show message
              structureOutput.textContent = "(No processable files found matching criteria)";
              contentOutput.textContent = "(No content to display)";
              resultsContainer.style.display = 'flex'; // Show results section even if empty
            }

            // --- Update Summary and Final Status ---
            repoNameDisplay.textContent = currentRepoName; filesCountDisplay.textContent = processedFileCount;

            let finalMessage = `✅Done.Processed $ {
              processedFileCount
            }
            files.`;
            if (ignoredCount > 0) finalMessage += `Ignored / Filtered $ {
              ignoredCount
            }.`;
            if (readErrorCount > 0) finalMessage += `Read errors: $ {
              readErrorCount
            }.`;
            if (currentInputMode === 'url' && skippedApiLimitCount > 0) finalMessage += `API Skips( > 1MB) : $ {
              skippedApiLimitCount
            }.`; finalMessage += `Total items analyzed: $ {
              totalItems
            }.`; setStatus(finalMessage, 'success', 'final');

            // Enable buttons if there's content
            const hasOutput = processedFileCount > 0; downloadTxtButton.disabled = !hasOutput; copyAllButton.disabled = !hasOutput; copyStructureButton.disabled = !hasOutput; copyContentButton.disabled = !hasOutput;

          } catch(error) {
            console.error("Processing error:", error);
            setStatus(`❌Error: $ {
              error.message
            }`, 'error', 'final');
            resultsContainer.style.display = 'none'; // Hide results on error
          } finally {
            setUIDisabled(false); // Re-enable UI
          }
        }

        // --- Specific Fetch Functions ---

        async
        function handleFolderSelect(event) {
          const files = event.target.files;
          if (!files || files.length === 0) {
            setStatus('No folder selected or folder is empty.', 'warning', 'local');
            return;
          }

          const fileList = Array.from(files);
          const rootFolderName = fileList[0] ? .webkitRelativePath ? .split('/')[0] || 'local_codebase';

          await processFiles(async() = >{
            const filesToProcess = fileList.map(file = >{
              const firstSlashIndex = file.webkitRelativePath.indexOf('/');
              const relativePath = firstSlashIndex !== -1 ? file.webkitRelativePath.substring(firstSlashIndex + 1) : file.webkitRelativePath;

              return {
                path: relativePath,
                name: file.name,
                size: file.size,
                isGitignore: relativePath === '.gitignore',
                // Check relative path
                read: () = >readFileContentLocal(file) // Closure to read this specific file
              };
            }).filter(f = >f.path); // Filter out potential root folder entry with empty path

            return {
              filesToProcess: filesToProcess,
              totalItems: fileList.length,
              repoName: rootFolderName
            };
          });
          folderInput.value = null; // Allow selecting same folder again
        }

        async
        function handleUrlFetch() {
          const repoUrl = urlInput.value.trim();
          if (!repoUrl) {
            setStatus('Please enter a GitHub URL.', 'warning', 'url');
            return;
          }
          const repoInfo = parseGitHubUrl(repoUrl);
          if (!repoInfo) {
            setStatus('Invalid GitHub URL format.', 'error', 'url');
            return;
          }

          await processFiles(async() = >{
            const allFilesMeta = await fetchRepoContentsRecursive(repoInfo.owner, repoInfo.repo, '');

            const filesToProcess = allFilesMeta
            // First pass filter: skip dirs, check API limits early if possible
            .filter(item = >item.type === 'file')
            // .filter(item => item.size <= GITHUB_API_MAX_FILE_SIZE_BYTES) // Check done in main loop now
            .map(item = >({
              path: item.path,
              name: item.path.split('/').pop(),
              size: item.size,
              isGitignore: item.path === '.gitignore',
              read: () = >fetchFileContentFromAPI(repoInfo.owner, repoInfo.repo, item.path, item.size)
            }));

            return {
              filesToProcess: filesToProcess,
              totalItems: allFilesMeta.length,
              // Total listed items (files + dirs)
              repoName: `$ {
                repoInfo.owner
              }
              /${repoInfo.repo}`
              };
         });
    }


    / / ---Directory Structure Generation---
              // buildFileTreeData and generateDirectoryStructureText remain the same as the previous version

              function buildFileTreeData(files) {
                const tree = {};
                files.sort((a, b) = >a.path.localeCompare(b.path)).forEach(file = >{
                  const pathParts = file.path.split('/');
                  let currentLevel = tree;
                  pathParts.forEach((part, index) = >{
                    if (!part) return;
                    if (index === pathParts.length - 1) {
                      currentLevel[part] = {
                        type: 'file'
                      };
                    } else {
                      if (!currentLevel[part]) {
                        currentLevel[part] = {
                          type: 'dir',
                          children: {}
                        };
                      }
                      if (currentLevel[part].type === 'file') {
                        currentLevel[part] = {
                          type: 'dir',
                          children: {}
                        };
                      }
                      currentLevel = currentLevel[part].children;
                    }
                  });
                });
                return tree;
              }

              function generateDirectoryStructureText(files, rootDirName = 'repository') {
                if (!files || files.length === 0) {
                  return`└──$ {
                    rootDirName
                  }
                  /\n    (No processable files found)\n`;
        }
        const treeData = buildFileTreeData(files);
        let structure = `└── ${rootDirName}/\n`;

                  function renderTextNode(nodes, prefix) {
                    const keys = Object.keys(nodes).sort();
                    keys.forEach((key, index) = >{
                      const node = nodes[key];
                      const isLast = index === keys.length - 1;
                      const connector = isLast ? '└── ': '├── ';
                      const nodePrefix = prefix + connector;
                      structure += nodePrefix + key + (node.type === 'dir' ? '/': '') + '\n';
                      if (node.type === 'dir' && node.children && Object.keys(node.children).length > 0) {
                        const childPrefix = prefix + (isLast ? '    ': '│   ');
                        renderTextNode(node.children, childPrefix);
                      }
                    });
                  }
                  renderTextNode(treeData, '    ');
                  return structure;
                }

                // --- Download Functionality ---
                function handleDownloadTxt() {
                  const fullOutput = fullStructureText + COMBINED_SEPARATOR + fullContentText;
                  if (!fullOutput || fullOutput.length === COMBINED_SEPARATOR.length) { // Check if effectively empty
                    setStatus('No output content to download.', 'warning', 'download');
                    return;
                  }
                  setStatus('💾 Preparing download...', 'info', 'download');
                  try {
                    const blob = new Blob([fullOutput], {
                      type: 'text/plain;charset=utf-8'
                    });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    const filenameSafeRepoName = currentRepoName.replace(/[\/\\:]/g, '_'); // Sanitize repo name for filename
                    link.download = `$ {
                      filenameSafeRepoName
                    }
                    _ingest.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                    setStatus('✅ Download ready.', 'success', 'download');
                    setTimeout(() = >setStatus('', 'info', 'download'), 3000);
                  } catch(error) {
                    console.error("Error creating text file download:", error);
                    setStatus(`❌Download failed: $ {
                      error.message
                    }`, 'error', 'download');
                  }
                }

                // --- Copy Functionality ---
                function copyToClipboard(textToCopy, buttonElement, contentTypeLabel = 'Output') {
                  if (!textToCopy) return;
                  navigator.clipboard.writeText(textToCopy).then(() = >{
                    const originalButtonText = buttonElement.innerHTML; // Store full HTML including icon
                    buttonElement.innerHTML = ` < span class = "icon" > ✅ < /span> Copied!`;
                buttonElement.classList.add('copied');
                / / Quick status update near the button(optional)
                    // setStatus(`${contentTypeLabel} copied!`, 'success', 'final');
                    setTimeout(() = >{
                      buttonElement.innerHTML = originalButtonText;
                      buttonElement.classList.remove('copied');
                      // Optionally clear final status if it was the copy message
                      // if (finalStatusDisplay.textContent === `${contentTypeLabel} copied!`) {
                      //    setStatus('', 'info', 'final');
                      // }
                    },
                    2000);
                  }).
                  catch(err = >{
                    console.error(`Failed to copy $ {
                      contentTypeLabel
                    }: `, err);
                    setStatus(`❌Failed to copy $ {
                      contentTypeLabel
                    }.See console.`, 'error', 'final');
                    alert(`Automatic copy failed
                    for $ {
                      contentTypeLabel
                    }.Please
                    try copying manually.`);
                  });
                }

                // --- Utility Functions ---
                // Keep: parseUserPatterns, parseGitignore, shouldProcessFile, isLikelyBinaryByExtension,
                // matchesSimplePattern, formatSize, readFileContentLocal, fetchRepoContentsRecursive,
                // fetchFileContentFromAPI, processPromisesBatch, parseGitHubUrl
                // (No changes needed in these low-level helpers from the previous version)
                function parseUserPatterns(patternsString) {
                  if (!patternsString) return [];
                  return patternsString.split(',').map(p = >p.trim()).filter(p = >p);
                }
                function parseGitignore(content) {
                  if (!content) return [];
                  return content.split('\n').map(line = >line.trim()).filter(line = >line && !line.startsWith('#'));
                }
                function shouldProcessFile(relativePath, fileSize, fileName) {
                  if (!relativePath || relativePath === '.git') return false;
                  for (const {
                    pattern,
                    isDir
                  }
                  of ALWAYS_IGNORE_PATTERNS) {
                    if (matchesSimplePattern(relativePath, pattern, isDir)) return false;
                  }
                  if (fileSize > currentMaxSizeBytes) return false;
                  if (isLikelyBinaryByExtension(fileName)) return false;
                  const userPatterns = parseUserPatterns(filterPatternsInput.value);
                  const filterMode = filterModeSelect.value;
                  let matchesUserPattern = false;
                  if (userPatterns.length > 0) {
                    matchesUserPattern = userPatterns.some(p = >matchesSimplePattern(relativePath, p));
                  }
                  if (filterMode === 'Include') {
                    if (userPatterns.length > 0 && !matchesUserPattern) return false;
                  } else {
                    if (userPatterns.length > 0 && matchesUserPattern) return false;
                  }
                  if (relativePath.endsWith('/.gitignore') || relativePath === '.gitignore') {
                    if (filterMode === 'Exclude' && matchesUserPattern) return false;
                    return true;
                  }
                  for (const rule of gitignoreRules) {
                    const trimmedRule = rule.trim();
                    if (!trimmedRule || trimmedRule.startsWith('#') || trimmedRule.startsWith('!')) continue;
                    if (matchesSimplePattern(relativePath, trimmedRule)) return false;
                  }
                  return true;
                }
                function isLikelyBinaryByExtension(filename) {
                  if (!filename) return false;
                  const lowerFilename = filename.toLowerCase();
                  const lastDotIndex = lowerFilename.lastIndexOf('.');
                  if (lastDotIndex < 1 || lastDotIndex === lowerFilename.length - 1) return BINARY_EXTENSIONS.has(lowerFilename);
                  const extension = lowerFilename.substring(lastDotIndex);
                  return BINARY_EXTENSIONS.has(extension);
                }
                function matchesSimplePattern(path, pattern, isDirPattern = pattern.endsWith('/')) {
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
                      try {
                        return new RegExp(regexPattern).test(normalizedPath);
                      } catch(e) {
                        return false;
                      }
                    } else {
                      return normalizedPath === pattern || normalizedPath.startsWith(pattern + '/');
                    }
                  }
                  if (pattern.includes('/')) {
                    if (pattern.includes('*')) {
                      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*');
                      try {
                        return new RegExp(regexPattern).test(normalizedPath);
                      } catch(e) {
                        return false;
                      }
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
                        return pathSegments.some(segment = >regex.test(segment));
                      } catch(e) {
                        return false;
                      }
                    } else {
                      return pathSegments.some(segment = >segment === pattern);
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
                    return`$ {
                      size
                    }
                    $ {
                      sizes[i + 1]
                    }`;
                  }
                  return`$ {
                    size
                  }
                  $ {
                    sizes[i]
                  }`;
                }
                function readFileContentLocal(file, sizeLimitOverride = null) {
                  return new Promise((resolve, reject) = >{
                    const sizeLimit = sizeLimitOverride !== null ? sizeLimitOverride: currentMaxSizeBytes;
                    if (file.size > sizeLimit) return reject(new Error(`Size($ {
                      formatSize(file.size)
                    }) > limit($ {
                      formatSize(sizeLimit)
                    })`));
                    if (file.size === 0) return resolve("");
                    const reader = new FileReader();
                    reader.onload = (event) = >{
                      const text = event.target.result;
                      if (text && text.indexOf('\u0000') !== -1) reject(new Error(`Null byte detected: $ {
                        file.name
                      }`));
                      else resolve(text);
                    };
                    reader.onerror = (event) = >reject(new Error(`Read error: $ {
                      reader.error
                    }`));
                    reader.readAsText(file);
                  });
                }
                async
                function fetchRepoContentsRecursive(owner, repo, path = '', accumulatedFiles = []) {
                  const apiUrl = `https: //api.github.com/repos/${owner}/${repo}/contents/${path}`; const response = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } }); if (!response.ok) { let errorMsg = `API Error (${response.status}) path "/${path}".`; try { const d = await response.json(); errorMsg = `API Error: ${d.message||response.statusText} path "/${path}"`; } catch(e){} if (response.status === 404) errorMsg = `Not found: ${owner}/${repo}/${path}`; if (response.status === 403) {const r=response.headers.get('X-RateLimit-Remaining'); if(r&&parseInt(r)===0){const t=new Date(parseInt(response.headers.get('X-RateLimit-Reset'))*1000);errorMsg=`Rate limit exceeded. Try after ${t.toLocaleTimeString()}.`;}else{errorMsg=`Access denied for ${owner}/${repo}/${path}.`;}} throw new Error(errorMsg); } const items = await response.json(); if (!Array.isArray(items)) { if(items.type==='file'||items.type==='dir'){accumulatedFiles.push({path:items.path,size:items.size,sha:items.sha,type:items.type,url:items.url}); if(items.type==='dir')await fetchRepoContentsRecursive(owner,repo,items.path,accumulatedFiles); return accumulatedFiles;}else{throw new Error(`Unexpected API response path "${path}".`);}} const directoryPromises = []; for (const item of items) { accumulatedFiles.push({ path: item.path, size: item.size, sha: item.sha, type: item.type, url: item.url }); if (item.type === 'dir') directoryPromises.push(fetchRepoContentsRecursive(owner, repo, item.path, accumulatedFiles)); } await Promise.all(directoryPromises); return accumulatedFiles; }
                  async
                  function fetchFileContentFromAPI(owner, repo, filePath, fileSize) {
                    if (fileSize > GITHUB_API_MAX_FILE_SIZE_BYTES) throw new Error(`File size($ {
                      formatSize(fileSize)
                    }) > API limit($ {
                      formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)
                    })`);
                    if (fileSize === 0) return "";
                    const apiUrl = `https: //api.github.com/repos/${owner}/${repo}/contents/${filePath}`; const response = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3.raw' } }); if (!response.ok) { let errorMsg = `API fetch error (${response.status}) "${filePath}".`; if (response.status === 403) errorMsg = `Access denied/rate limit fetching "${filePath}".`; try { const jsonResponse = await fetch(apiUrl.replace('.raw', '+json')); if (jsonResponse.ok) { const d = await jsonResponse.json(); if (d.encoding === 'base64' && d.content) { if (d.size > GITHUB_API_MAX_FILE_SIZE_BYTES) throw new Error(`File size (${formatSize(d.size)}) > API limit (${formatSize(GITHUB_API_MAX_FILE_SIZE_BYTES)})`); try { const c = atob(d.content); if (c.indexOf('\u0000') !== -1) throw new Error(`Null byte detected (base64): ${filePath}`); return c; } catch (e) { throw new Error(`Base64 decode failed: ${e.message}`); } } } } catch (e) { /* ignore fallback */ } throw new Error(errorMsg); } const content = await response.text(); if (content && content.indexOf('\u0000') !== -1) throw new Error(`Null byte detected (raw): ${filePath}`); return content; }
                    async
                    function processPromisesBatch(promises, batchSize, progressCallback) {
                      let results = [];
                      let index = 0;
                      while (index < promises.length) {
                        const batch = promises.slice(index, index + batchSize);
                        const batchResults = await Promise.all(batch);
                        results = results.concat(batchResults);
                        index += batch.length;
                        if (progressCallback) progressCallback(index, promises.length);
                        const delay = (currentInputMode === 'url' && index < promises.length) ? 50 : 0;
                        await new Promise(resolve = >setTimeout(resolve, delay));
                      }
                      return results;
                    }
                    function parseGitHubUrl(url) {
                      try {
                        const u = new URL(url);
                        if (u.hostname !== 'github.com') return null;
                        const p = u.pathname.split('/').filter(Boolean);
                        if (p.length < 2) return null;
                        const[owner, repo] = p;
                        const r = repo.endsWith('.git') ? repo.slice(0, -4) : repo;
                        return {
                          owner,
                          repo: r
                        };
                      } catch(e) {
                        return null;
                      }
                    }

                  }); // End DOMContentLoaded
                  