const {
	clipboard,
	nativeImage,
	remote
} = require('electron');

const { BrowserWindow } = remote;

const LEFT_OFFSET = 70;
const TAB_WIDTH   = 126; // @TODO - What is the tab grows?

class NegativeTabs {
	constructor() {
		this.dragOverIndex = null;
		this.tabIndex      = 0;
		this.tabs          = [ this.getEmptyModel() ];
		this.tabsContainer = document.getElementById('tabs');
			
		// Tab Selecting
		this.tabsContainer.addEventListener('mousedown', this._mouseDown.bind(this), false);

		// Tab Dragging
		this.tabsContainer.addEventListener('dragstart', this._dragStart.bind(this), false);
		this.tabsContainer.addEventListener('dragover', this._dragOver.bind(this), false);
		this.tabsContainer.addEventListener('dragend', this._dragResetStyles.bind(this), false);
		this.tabsContainer.addEventListener('drop', this._drop.bind(this), false);

		// Traffic lights
		// @TODO - These have nothing to do with tabs. Move to negative-traffic-lights.js
		document.getElementById('close').addEventListener('click', (evt) => {
			BrowserWindow.getFocusedWindow().close();
		});

		document.getElementById('minimize').addEventListener('click', (evt) => {
			BrowserWindow.getFocusedWindow().minimize();
		});

		document.getElementById('maximize').addEventListener('click', (evt) => {
			BrowserWindow.getFocusedWindow().maximize();
		});
	}
	
	_mouseDown(evt) {
		const { target } = evt;

		if (target) {
			if (target.classList.contains('tab')) {
				this.deselectTabByIndex(this.tabIndex);

				this.tabIndex = Array.from(this.tabsContainer.children).indexOf(target);

				this.selectTabByIndex(this.tabIndex);
			} else if (target.classList.contains('close')) {
				// @TODO: Rethink moving this to a click event
				this.closeTab();
			}
		}
	}
	
	_dragStart(evt) {
		const { target } = evt;

		if (target) {
			if (target.classList.contains('tab') && this.tabs.length > 1) {
				evt.dataTransfer.setData('from-index', `${this.tabIndex}`);
				evt.dataTransfer.effectAllowed = 'move';
			} else {
				evt.preventDefault();
				return false;
			}
		}
	}
	
	_dragOver(evt) {
		evt.preventDefault();

		const x         = evt.x - LEFT_OFFSET;
		const toIndex   = Math.floor(x / TAB_WIDTH);
		const fromIndex = +evt.dataTransfer.getData('from-index');
			
		if (toIndex !== this.dragOverIndex) {
			const newTransform = (((toIndex - fromIndex) * TAB_WIDTH)) + 'px';
			
			this.tabsContainer.children[fromIndex].style.left = newTransform;
			this.dragOverIndex = toIndex;
		}
		
		Array.from(this.tabsContainer.children).forEach((tab, i) => {
			if (fromIndex > i) {
				if (toIndex <= i) {
					tab.classList.add('shift-right');
				} else {
					tab.classList.remove('shift-right');
				}
			} else if (fromIndex < i) {
				if (toIndex >= i) {
					tab.classList.add('shift-left');
				} else {
					tab.classList.remove('shift-left');
				}
			}
		});
	}
	
	_dragResetStyles() {
		this.tabsContainer.classList.add('shift-none');
		setTimeout(() => {
			this.tabsContainer.classList.remove('shift-none');
		}, 250);
		
		Array.from(this.tabsContainer.children).forEach((tab) => {
			tab.style.transform = '';
			tab.style.left = '';
			this.dragOverIndex = null;
		
			setTimeout(() => {
				tab.classList.remove('shift-left', 'shift-right');
			}, 250);
		});
	}
	
	_drop(evt) {
		evt.preventDefault();

		const { target } = evt;

		if (target && target.classList.contains('tab')) {
			const x             = evt.x - LEFT_OFFSET;
			const toIndex       = Math.floor(x / TAB_WIDTH);
			const fromIndex     = +evt.dataTransfer.getData('from-index');
			const spliceToIndex = toIndex > fromIndex ? toIndex + 1 : toIndex;
				
			this.moveTab(fromIndex, spliceToIndex);
			this.tabs.splice(spliceToIndex, 0, this.tabs.splice(fromIndex, 1, null)[0]);
			this.tabs = this.tabs.filter(function (tab) { return tab !== null; });
			this.tabIndex = toIndex;
			
			this._dragResetStyles();
		}
	}

	addTab() {
		this.deselectTabByIndex(this.tabIndex);
		this.tabIndex++;
		this.tabs.splice(this.tabIndex, 0, this.getEmptyModel());

		const newTabButton = this.getTabButtonElement(true);
		
		this.tabsContainer.insertBefore(newTabButton, this.getCurrentTab());
		this.tabsContainer.style.width = `${this.tabs.length * TAB_WIDTH}px`;
		newTabButton.focus();

		window.negative.frameController.removeImage();

		this.refreshMenu();
	}

	closeTab() {
		const closedTabIndex = this.tabIndex;

		if (!this.canSelectNextTab()) {
			if (this.canSelectPreviousTab()) {
				this.tabIndex--;
			} else {
				BrowserWindow.getFocusedWindow().close();
				return;
			}
		}
		this.tabs.splice(closedTabIndex, 1);

		this.tabsContainer.children[closedTabIndex].remove();
		this.tabsContainer.style.width = `${this.tabs.length * TAB_WIDTH}px`;
		this.selectTabByIndex(this.tabIndex);
	}

	getCurrentTab() {
		return this.tabsContainer.children[this.tabIndex];
	}

	moveTab(fromIndex, toIndex) {
		this.tabsContainer.insertBefore(this.tabsContainer.children[fromIndex], this.tabsContainer.children[toIndex]);
	}

	canSelectNextTab() {
		return this.tabIndex + 1 < this.tabs.length;
	}

	canSelectPreviousTab() {
		return this.tabIndex > 0;
	}

	selectTabByIndex(index) {
		const newTab          = this.tabs[index].undoManager.state;
		const newTabButton    = this.tabsContainer.children[index];
		const {
			imageDimensions,
			imageSrc
		} = newTab;

		newTabButton.classList.add('selected');
		newTabButton.setAttribute('aria-selected', 'true');
		newTabButton.focus();

		if (imageSrc && imageDimensions) {
			window.negative.frameController.setImageAndSize(imageSrc, imageDimensions[0], imageDimensions[1]);
		} else {
			window.negative.frameController.removeImage();
		}

		this.refreshMenu();
	}

	deselectTabByIndex(index) {
		const oldTab = this.tabsContainer.children[index];
		
		oldTab.classList.remove('selected');
		oldTab.setAttribute('aria-selected', 'false');
	}

	selectNextTab() {
		const canSelectNextTab = this.canSelectNextTab();

		if (canSelectNextTab) {
			this.deselectTabByIndex(this.tabIndex);
			this.tabIndex++;
			this.selectTabByIndex(this.tabIndex);
		}

		return canSelectNextTab;
	}

	selectPreviousTab() {
		const canSelectPreviousTab = this.canSelectPreviousTab();

		if (canSelectPreviousTab) {
			this.deselectTabByIndex(this.tabIndex);
			this.tabIndex--;
			this.selectTabByIndex(this.tabIndex);
		}

		return canSelectPreviousTab;
	}

	setTabHasContent() {
		this.getCurrentTab().classList.add('has-content');
	}

	unsetTabHasContent() {
		this.getCurrentTab().classList.remove('has-content');
	}

	setTabLabel(label) {
		this.getCurrentTab().children[0].textContent = label;
	}

	getEmptyModel() {
		return {
			undoManager: new UndoManager()
		};
	}

	/**
	 * Returns a DOM Node representing the tab, with the structure:
	 * <div class="tab selected" aria-selected="true">
	 *     <span class="label"></span>
	 *     <button class="close" aria-label="close"></button>
	 * </div>
	 * @param  {Boolean} isSelected Adds `selected` class and `aria-selected=true`
	 * @return {Node}
	 */
	getTabButtonElement(isSelected) {
		const tabDiv      = document.createElement('div');
		const labelSpan   = document.createElement('span');
		const closeButton = document.createElement('button');

		tabDiv.classList.add('tab');
		tabDiv.setAttribute('draggable', 'true');

		labelSpan.classList.add('label');

		closeButton.classList.add('close');
		closeButton.setAttribute('aria-label', 'close');
		closeButton.innerHTML = '&times;';

		if (isSelected) {
			tabDiv.classList.add('selected');
			tabDiv.setAttribute('aria-selected', 'true');
		}

		tabDiv.appendChild(labelSpan);
		tabDiv.appendChild(closeButton);

		return tabDiv;
	}

	saveForUndo(state) {
		const undoManager = this.tabs[this.tabIndex].undoManager;

		undoManager.save(state);

		this.refreshMenu();
	}

	undo() {
		const undoManager = this.tabs[this.tabIndex].undoManager;

		undoManager.undo();

		this.refreshMenu();
	}

	redo() {
		const undoManager = this.tabs[this.tabIndex].undoManager;

		undoManager.redo();

		this.refreshMenu();
	}

	copy() {
		const undoManagerState = this.tabs[this.tabIndex].undoManager.state;
		const {
			imageDimensions,
			imageSrc
		} = undoManagerState;

		if (imageSrc !== null && imageDimensions !== null) {
			clipboard.write({
				image: nativeImage.createFromDataURL(imageSrc),
				text: JSON.stringify(imageDimensions)
			});

			this.refreshMenu();
		}
	}

	paste() {
		const image = clipboard.readImage()
		
		let imageDimensions;

		try {
			// Try to parse text as image dimensions, but this could anything,
			// such as the image's file name, so prevent the error.
			imageDimensions = JSON.parse(clipboard.readText() || null);
		} catch (err) {
			// @TODO - Should this throw?
			// throw err;
		}

		if (image !== null) {
			if (!imageDimensions) {
				imageDimensions = (function (dims) { return [dims.width, dims.height]; })(image.getSize());
			}

			const imageSrc = image.toDataURL();

			window.negative.frameController.setImageAndSize(imageSrc, imageDimensions[0], imageDimensions[1]);
			this.saveForUndo({
				imageDimensions: imageDimensions,
				imageSrc: imageSrc
			});
			this.refreshMenu();
		}
	}

	refreshMenu() {
		const undoManager = this.tabs[this.tabIndex].undoManager;

		ipcRenderer.send('refresh-menu', {
			canAddTab: true,
			canCloseTab: true,
			canCloseWindow: true,
			canUndo: undoManager.canUndo(),
			canRedo: undoManager.canRedo(),
			canCapture: true,
			isImageEmpty: undoManager.state.imageSrc === null,
			canReload: true,
			canToggleDevTools: true,
			canSelectPreviousTab: this.canSelectPreviousTab(),
			canSelectNextTab: this.canSelectNextTab(),
			canMinimize: true,
			canMove: true
		});
	}

	fitWindowToImage() {
		const undoManagerState = this.tabs[this.tabIndex].undoManager.state;

		ipcRenderer.send('fit-window-to-image', undoManagerState.imageDimensions);
	}
}
