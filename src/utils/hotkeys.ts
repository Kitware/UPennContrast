export default class HotkeysHandler {
  modifiers: string[] = [
    "Control",
    "Alt",
    "Shift",
    "Meta",
    "OS",
    "AltGraph",
    "Fn"
  ];

  disablingTags: string[] = ["INPUT", "SELECT", "TEXTAREA"];

  lastHotkey: null | string = null;

  hotkeyCallbacks: Map<string, ((evt: any) => void)[]> = new Map();

  composeNewHotkey: boolean = false;

  constructor(callbacks?: { hotkey: string; callback: (evt: any) => void }[]) {
    // hotkeys are vscode inspired and consist of: a keydown (with any number of modifier) [chord to: a keydown (with any number of modifier)]
    window.addEventListener("keydown", this.hotkeyListener.bind(this));
    callbacks?.forEach(({ hotkey, callback }) => {
      this.addBinding(hotkey, callback);
    });
  }

  addBinding(hotkey: string, callback: (evt: any) => void) {
    if (!this.hotkeyCallbacks.has(hotkey)) {
      this.hotkeyCallbacks.set(hotkey, []);
    }
    this.hotkeyCallbacks.get(hotkey)?.push(callback);
  }

  removeBinding(hotkey: string, callback?: (evt: any) => void) {
    if (!callback) {
      this.hotkeyCallbacks.delete(hotkey);
      return;
    }
    const newCallbacks = this.hotkeyCallbacks
      .get(hotkey)
      ?.filter(otherCallback => otherCallback !== callback);
    if (newCallbacks && newCallbacks.length) {
      this.hotkeyCallbacks.set(hotkey, newCallbacks);
    } else {
      this.hotkeyCallbacks.delete(hotkey);
    }
  }

  shouldListenToHotkey(evt: any): boolean {
    // Don't listen to repeated keys or modifiers
    if (evt.repeat || this.modifiers.includes(evt.key)) {
      return false;
    }
    // Disable shortcuts in some elements
    if (
      this.disablingTags.includes(evt.target.tagName) ||
      (evt.target.contentEditable && evt.target.contentEditable == "true")
    ) {
      return false;
    }

    return true;
  }

  hotkeyListener(evt: any): void {
    if (!this.shouldListenToHotkey(evt)) {
      return;
    }
    const keyList = this.modifiers.filter(evt.getModifierState.bind(evt));
    keyList.push(evt.key);
    this.lastHotkey = keyList.join("+");
    if (!this.composeNewHotkey) {
      this.hotkeyCallbacks.get(this.lastHotkey)?.map(callback => {
        callback(evt);
      });
    }
  }

  startComposing(): void {
    this.composeNewHotkey = true;
    this.lastHotkey = null;
  }

  stopComposing(): null | string {
    this.composeNewHotkey = false;
    return this.lastHotkey;
  }
}
