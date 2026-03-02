; EDO-Aware MIDI Interval Macro for DAW Piano Roll
; Press Ctrl+` to open configuration GUI
; Configuration is saved to midi_config.ini

#SingleInstance Force
#MaxThreadsPerHotkey 20  ; Allow multiple instances of same hotkey to queue
SetNumLockState, AlwaysOn  ; Force NumLock on to prevent numpad key name changes
SetKeyDelay, 0, 0  ; No delay between keypresses (fastest possible)
SetBatchLines, -1  ; Run script at maximum speed

; ===== GLOBAL VARIABLES =====
global CurrentEDO := 12
global ConfigFile := A_ScriptDir . "\midi_config.ini"
global CurrentPreset := "Default"
global PresetList := []
global SleepDelay := 0  ; Milliseconds between keypresses

; Default intervals (can be customized)
global Interval1 := "3/2"
global Interval2 := "5/4"
global Interval3 := "7/4"
global Interval4 := "11/8"
global Interval5 := "13/8"
global Interval6 := "2/1"
global Interval7 := "1/1"

; Slot enable/disable states
global Slot1Enabled := true
global Slot2Enabled := true
global Slot3Enabled := true
global Slot4Enabled := true
global Slot5Enabled := true
global Slot6Enabled := true
global Slot7Enabled := true

; Default hotkeys (can be customized)
global Hotkey1Up := "NumpadDiv"
global Hotkey1Down := "NumpadMult"
global Hotkey2Up := "Numpad8"
global Hotkey2Down := "Numpad9"
global Hotkey3Up := "Numpad5"
global Hotkey3Down := "Numpad6"
global Hotkey4Up := "Numpad2"
global Hotkey4Down := "Numpad3"
global Hotkey5Up := "Numpad0"
global Hotkey5Down := "NumpadDot"
global Hotkey6Up := "Numlock"
global Hotkey6Down := "Numpad7"
global Hotkey7Up := "NumpadHome"
global Hotkey7Down := "NumpadEnd"

; Undo/Redo hotkeys
global HotkeyUndo := "NumpadSub"
global HotkeyRedo := "NumpadAdd"

; Copy+Paste and Paste hotkeys
global HotkeyCopyPaste := "``"
global HotkeyPaste := "-"

; Arrow key hotkeys
global HotkeyLeft := "a"
global HotkeyRight := "d"
global HotkeyUp := "s"
global HotkeyDown := "f"

; Toggle hotkey to enable/disable all MIDI hotkeys
global HotkeyToggle := "NumpadEnter"
global HotkeysEnabled := false  ; Start with hotkeys disabled

; Undo/Redo history tracking
global ActionHistory := []
global RedoStack := []
global MaxHistorySize := 100

; ===== INITIALIZATION =====
LoadConfig()
RegisterHotkeys()
Suspend, On  ; Start with MIDI hotkeys disabled
ShowConfigGUI()  ; Show GUI on startup

; ===== HELPER FUNCTIONS =====

; Check if any modifier key (Ctrl, Alt, Win) is held down
; Returns true if a modifier is held, meaning the hotkey should pass through
HasModifierHeld() {
    if GetKeyState("Ctrl", "P")
        return true
    if GetKeyState("Alt", "P")
        return true
    if GetKeyState("LWin", "P")
        return true
    if GetKeyState("RWin", "P")
        return true
    return false
}

; Send the original key with whatever modifiers are currently held
PassthroughKey() {
    key := A_ThisHotkey
    ; Strip the wildcard prefix
    key := RegExReplace(key, "^\*", "")
    ; Build modifier prefix
    mods := ""
    if GetKeyState("Ctrl", "P")
        mods .= "^"
    if GetKeyState("Alt", "P")
        mods .= "!"
    if GetKeyState("Shift", "P")
        mods .= "+"
    if GetKeyState("LWin", "P") || GetKeyState("RWin", "P")
        mods .= "#"
    Send %mods%{%key%}
}

; Parse ratio string (e.g., "3/2" or "1.5") to decimal
ParseRatio(ratioStr) {
    if InStr(ratioStr, "/") {
        parts := StrSplit(ratioStr, "/")
        if (parts.Length() = 2 && parts[1] > 0 && parts[2] > 0)
            return parts[1] / parts[2]
    } else {
        return ratioStr + 0  ; Convert to number
    }
    return 0
}

; Calculate the closest EDO step for a given ratio
CalculateInterval(ratioStr) {
    global CurrentEDO
    ratio := ParseRatio(ratioStr)
    if (ratio <= 0)
        return 0
    ; Convert ratio to cents
    cents := 1200 * Log(ratio) / Log(2)
    ; Calculate step size for current EDO
    stepSize := 1200 / CurrentEDO
    ; Find closest step
    steps := Round(cents / stepSize)
    return steps
}

; Move selection up or down by a number of steps using arrow keys only
MoveBySteps(steps, direction) {
    global ActionHistory, RedoStack, MaxHistorySize, SleepDelay

    ; Send individual arrow key steps with minimal delay
    Loop % Abs(steps) {
        if (direction = "up")
            Send {Up}
        else
            Send {Down}
        Sleep %SleepDelay%
    }

    ; Track this action for undo/redo
    if (Abs(steps) > 0) {
        ActionHistory.Push(Abs(steps))
        ; Clear redo stack when new action is performed
        RedoStack := []
        ; Limit history size
        if (ActionHistory.Length() > MaxHistorySize)
            ActionHistory.RemoveAt(1)
    }
}

; Undo last interval action by sending Ctrl+Z the appropriate number of times
UndoLastAction() {
    global ActionHistory, RedoStack, SleepDelay

    if (ActionHistory.Length() = 0) {
        ToolTip, Nothing to undo
        SetTimer, RemoveToolTip, 1000
        return
    }

    ; Pop last action from history
    numKeys := ActionHistory.Pop()

    ; Send Ctrl+Z for each keypress that was sent
    Loop % numKeys {
        Send ^z
        Sleep %SleepDelay%
    }

    ; Add to redo stack
    RedoStack.Push(numKeys)

    ToolTip, Undone %numKeys% step(s)
    SetTimer, RemoveToolTip, 1000
}

; Redo last undone action by sending Ctrl+Y the appropriate number of times
RedoLastAction() {
    global ActionHistory, RedoStack, SleepDelay

    if (RedoStack.Length() = 0) {
        ToolTip, Nothing to redo
        SetTimer, RemoveToolTip, 1000
        return
    }

    ; Pop last undone action from redo stack
    numKeys := RedoStack.Pop()

    ; Send Ctrl+Y for each keypress that was undone
    Loop % numKeys {
        Send ^y
        Sleep %SleepDelay%
    }

    ; Add back to action history
    ActionHistory.Push(numKeys)

    ToolTip, Redone %numKeys% step(s)
    SetTimer, RemoveToolTip, 1000
}

; ===== CONFIG MANAGEMENT =====

LoadConfig() {
    global

    ; Load last used preset and preset list
    if FileExist(ConfigFile) {
        IniRead, CurrentPreset, %ConfigFile%, Settings, LastPreset, Default
        IniRead, presetListStr, %ConfigFile%, Settings, PresetList, Default

        ; Convert comma-separated string to array
        PresetList := []
        Loop, Parse, presetListStr, `,
        {
            PresetList.Push(A_LoopField)
        }
    } else {
        CurrentPreset := "Default"
        PresetList := ["Default"]
    }

    LoadPreset(CurrentPreset)
}

LoadPreset(presetName) {
    global

    section := "Preset_" . presetName

    if FileExist(ConfigFile) {
        IniRead, CurrentEDO, %ConfigFile%, %section%, EDO, 12
        IniRead, SleepDelay, %ConfigFile%, %section%, SleepDelay, 0

        IniRead, Interval1, %ConfigFile%, %section%, Interval1, 3/2
        IniRead, Interval2, %ConfigFile%, %section%, Interval2, 5/4
        IniRead, Interval3, %ConfigFile%, %section%, Interval3, 7/4
        IniRead, Interval4, %ConfigFile%, %section%, Interval4, 11/8
        IniRead, Interval5, %ConfigFile%, %section%, Interval5, 13/8
        IniRead, Interval6, %ConfigFile%, %section%, Interval6, 2/1
        IniRead, Interval7, %ConfigFile%, %section%, Interval7, 1/1

        IniRead, Slot1Enabled, %ConfigFile%, %section%, Slot1Enabled, 1
        IniRead, Slot2Enabled, %ConfigFile%, %section%, Slot2Enabled, 1
        IniRead, Slot3Enabled, %ConfigFile%, %section%, Slot3Enabled, 1
        IniRead, Slot4Enabled, %ConfigFile%, %section%, Slot4Enabled, 1
        IniRead, Slot5Enabled, %ConfigFile%, %section%, Slot5Enabled, 1
        IniRead, Slot6Enabled, %ConfigFile%, %section%, Slot6Enabled, 1
        IniRead, Slot7Enabled, %ConfigFile%, %section%, Slot7Enabled, 1

        IniRead, Hotkey1Up, %ConfigFile%, %section%, Hotkey1Up, NumpadDiv
        IniRead, Hotkey1Down, %ConfigFile%, %section%, Hotkey1Down, NumpadMult
        IniRead, Hotkey2Up, %ConfigFile%, %section%, Hotkey2Up, Numpad8
        IniRead, Hotkey2Down, %ConfigFile%, %section%, Hotkey2Down, Numpad9
        IniRead, Hotkey3Up, %ConfigFile%, %section%, Hotkey3Up, Numpad5
        IniRead, Hotkey3Down, %ConfigFile%, %section%, Hotkey3Down, Numpad6
        IniRead, Hotkey4Up, %ConfigFile%, %section%, Hotkey4Up, Numpad2
        IniRead, Hotkey4Down, %ConfigFile%, %section%, Hotkey4Down, Numpad3
        IniRead, Hotkey5Up, %ConfigFile%, %section%, Hotkey5Up, Numpad0
        IniRead, Hotkey5Down, %ConfigFile%, %section%, Hotkey5Down, NumpadDot
        IniRead, Hotkey6Up, %ConfigFile%, %section%, Hotkey6Up, Numlock
        IniRead, Hotkey6Down, %ConfigFile%, %section%, Hotkey6Down, Numpad7
        IniRead, Hotkey7Up, %ConfigFile%, %section%, Hotkey7Up, NumpadHome
        IniRead, Hotkey7Down, %ConfigFile%, %section%, Hotkey7Down, NumpadEnd

        IniRead, HotkeyUndo, %ConfigFile%, %section%, HotkeyUndo, NumpadSub
        IniRead, HotkeyRedo, %ConfigFile%, %section%, HotkeyRedo, NumpadAdd
        IniRead, HotkeyCopyPaste, %ConfigFile%, %section%, HotkeyCopyPaste, ``
        IniRead, HotkeyPaste, %ConfigFile%, %section%, HotkeyPaste, -
        IniRead, HotkeyLeft, %ConfigFile%, %section%, HotkeyLeft, a
        IniRead, HotkeyRight, %ConfigFile%, %section%, HotkeyRight, d
        IniRead, HotkeyUp, %ConfigFile%, %section%, HotkeyUp, s
        IniRead, HotkeyDown, %ConfigFile%, %section%, HotkeyDown, f
        IniRead, HotkeyToggle, %ConfigFile%, %section%, HotkeyToggle, NumpadEnter
    }

    CurrentPreset := presetName
}

SaveConfig() {
    global

    ; Save current preset name and preset list
    IniWrite, %CurrentPreset%, %ConfigFile%, Settings, LastPreset

    ; Convert preset list array to comma-separated string
    presetListStr := ""
    for index, preset in PresetList {
        presetListStr .= (index > 1 ? "," : "") . preset
    }
    IniWrite, %presetListStr%, %ConfigFile%, Settings, PresetList

    SavePreset(CurrentPreset)
}

SavePreset(presetName) {
    global

    section := "Preset_" . presetName

    IniWrite, %CurrentEDO%, %ConfigFile%, %section%, EDO
    IniWrite, %SleepDelay%, %ConfigFile%, %section%, SleepDelay

    IniWrite, %Interval1%, %ConfigFile%, %section%, Interval1
    IniWrite, %Interval2%, %ConfigFile%, %section%, Interval2
    IniWrite, %Interval3%, %ConfigFile%, %section%, Interval3
    IniWrite, %Interval4%, %ConfigFile%, %section%, Interval4
    IniWrite, %Interval5%, %ConfigFile%, %section%, Interval5
    IniWrite, %Interval6%, %ConfigFile%, %section%, Interval6
    IniWrite, %Interval7%, %ConfigFile%, %section%, Interval7

    IniWrite, %Slot1Enabled%, %ConfigFile%, %section%, Slot1Enabled
    IniWrite, %Slot2Enabled%, %ConfigFile%, %section%, Slot2Enabled
    IniWrite, %Slot3Enabled%, %ConfigFile%, %section%, Slot3Enabled
    IniWrite, %Slot4Enabled%, %ConfigFile%, %section%, Slot4Enabled
    IniWrite, %Slot5Enabled%, %ConfigFile%, %section%, Slot5Enabled
    IniWrite, %Slot6Enabled%, %ConfigFile%, %section%, Slot6Enabled
    IniWrite, %Slot7Enabled%, %ConfigFile%, %section%, Slot7Enabled

    IniWrite, %Hotkey1Up%, %ConfigFile%, %section%, Hotkey1Up
    IniWrite, %Hotkey1Down%, %ConfigFile%, %section%, Hotkey1Down
    IniWrite, %Hotkey2Up%, %ConfigFile%, %section%, Hotkey2Up
    IniWrite, %Hotkey2Down%, %ConfigFile%, %section%, Hotkey2Down
    IniWrite, %Hotkey3Up%, %ConfigFile%, %section%, Hotkey3Up
    IniWrite, %Hotkey3Down%, %ConfigFile%, %section%, Hotkey3Down
    IniWrite, %Hotkey4Up%, %ConfigFile%, %section%, Hotkey4Up
    IniWrite, %Hotkey4Down%, %ConfigFile%, %section%, Hotkey4Down
    IniWrite, %Hotkey5Up%, %ConfigFile%, %section%, Hotkey5Up
    IniWrite, %Hotkey5Down%, %ConfigFile%, %section%, Hotkey5Down
    IniWrite, %Hotkey6Up%, %ConfigFile%, %section%, Hotkey6Up
    IniWrite, %Hotkey6Down%, %ConfigFile%, %section%, Hotkey6Down
    IniWrite, %Hotkey7Up%, %ConfigFile%, %section%, Hotkey7Up
    IniWrite, %Hotkey7Down%, %ConfigFile%, %section%, Hotkey7Down

    IniWrite, %HotkeyUndo%, %ConfigFile%, %section%, HotkeyUndo
    IniWrite, %HotkeyRedo%, %ConfigFile%, %section%, HotkeyRedo
    IniWrite, %HotkeyCopyPaste%, %ConfigFile%, %section%, HotkeyCopyPaste
    IniWrite, %HotkeyPaste%, %ConfigFile%, %section%, HotkeyPaste
    IniWrite, %HotkeyLeft%, %ConfigFile%, %section%, HotkeyLeft
    IniWrite, %HotkeyRight%, %ConfigFile%, %section%, HotkeyRight
    IniWrite, %HotkeyUp%, %ConfigFile%, %section%, HotkeyUp
    IniWrite, %HotkeyDown%, %ConfigFile%, %section%, HotkeyDown
    IniWrite, %HotkeyToggle%, %ConfigFile%, %section%, HotkeyToggle
}

RegisterHotkeys() {
    global

    ; Unregister old hotkeys (try both variants for numpad keys)
    Hotkey, IfWinActive
    Hotkey, %Hotkey1Up%, Off, UseErrorLevel
    Hotkey, %Hotkey1Down%, Off, UseErrorLevel
    Hotkey, %Hotkey2Up%, Off, UseErrorLevel
    Hotkey, %Hotkey2Down%, Off, UseErrorLevel
    Hotkey, %Hotkey3Up%, Off, UseErrorLevel
    Hotkey, %Hotkey3Down%, Off, UseErrorLevel
    Hotkey, %Hotkey4Up%, Off, UseErrorLevel
    Hotkey, %Hotkey4Down%, Off, UseErrorLevel
    Hotkey, %Hotkey5Up%, Off, UseErrorLevel
    Hotkey, %Hotkey5Down%, Off, UseErrorLevel
    Hotkey, %Hotkey6Up%, Off, UseErrorLevel
    Hotkey, %Hotkey6Down%, Off, UseErrorLevel
    Hotkey, %Hotkey7Up%, Off, UseErrorLevel
    Hotkey, %Hotkey7Down%, Off, UseErrorLevel
    Hotkey, %HotkeyUndo%, Off, UseErrorLevel
    Hotkey, %HotkeyRedo%, Off, UseErrorLevel

    ; Register new hotkeys with wildcard (*) to allow any modifier state
    ; This fixes numpad modifier issues
    wildcard1Up := "*" . Hotkey1Up
    wildcard1Down := "*" . Hotkey1Down
    wildcard2Up := "*" . Hotkey2Up
    wildcard2Down := "*" . Hotkey2Down
    wildcard3Up := "*" . Hotkey3Up
    wildcard3Down := "*" . Hotkey3Down
    wildcard4Up := "*" . Hotkey4Up
    wildcard4Down := "*" . Hotkey4Down
    wildcard5Up := "*" . Hotkey5Up
    wildcard5Down := "*" . Hotkey5Down
    wildcard6Up := "*" . Hotkey6Up
    wildcard6Down := "*" . Hotkey6Down
    wildcard7Up := "*" . Hotkey7Up
    wildcard7Down := "*" . Hotkey7Down

    ; Only register enabled slots, turn off disabled ones
    if (Slot1Enabled) {
        Hotkey, %wildcard1Up%, Interval1Up_Handler, On UseErrorLevel
        Hotkey, %wildcard1Down%, Interval1Down_Handler, On UseErrorLevel
    } else {
        Hotkey, %wildcard1Up%, Off, UseErrorLevel
        Hotkey, %wildcard1Down%, Off, UseErrorLevel
    }
    if (Slot2Enabled) {
        Hotkey, %wildcard2Up%, Interval2Up_Handler, On UseErrorLevel
        Hotkey, %wildcard2Down%, Interval2Down_Handler, On UseErrorLevel
    } else {
        Hotkey, %wildcard2Up%, Off, UseErrorLevel
        Hotkey, %wildcard2Down%, Off, UseErrorLevel
    }
    if (Slot3Enabled) {
        Hotkey, %wildcard3Up%, Interval3Up_Handler, On UseErrorLevel
        Hotkey, %wildcard3Down%, Interval3Down_Handler, On UseErrorLevel
    } else {
        Hotkey, %wildcard3Up%, Off, UseErrorLevel
        Hotkey, %wildcard3Down%, Off, UseErrorLevel
    }
    if (Slot4Enabled) {
        Hotkey, %wildcard4Up%, Interval4Up_Handler, On UseErrorLevel
        Hotkey, %wildcard4Down%, Interval4Down_Handler, On UseErrorLevel
    } else {
        Hotkey, %wildcard4Up%, Off, UseErrorLevel
        Hotkey, %wildcard4Down%, Off, UseErrorLevel
    }
    if (Slot5Enabled) {
        Hotkey, %wildcard5Up%, Interval5Up_Handler, On UseErrorLevel
        Hotkey, %wildcard5Down%, Interval5Down_Handler, On UseErrorLevel
    } else {
        Hotkey, %wildcard5Up%, Off, UseErrorLevel
        Hotkey, %wildcard5Down%, Off, UseErrorLevel
    }
    if (Slot6Enabled) {
        Hotkey, %wildcard6Up%, Interval6Up_Handler, On UseErrorLevel
        Hotkey, %wildcard6Down%, Interval6Down_Handler, On UseErrorLevel
    } else {
        Hotkey, %wildcard6Up%, Off, UseErrorLevel
        Hotkey, %wildcard6Down%, Off, UseErrorLevel
    }
    if (Slot7Enabled) {
        Hotkey, %wildcard7Up%, Interval7Up_Handler, On UseErrorLevel
        Hotkey, %wildcard7Down%, Interval7Down_Handler, On UseErrorLevel
    } else {
        Hotkey, %wildcard7Up%, Off, UseErrorLevel
        Hotkey, %wildcard7Down%, Off, UseErrorLevel
    }

    ; Register undo/redo hotkeys
    wildcardUndo := "*" . HotkeyUndo
    wildcardRedo := "*" . HotkeyRedo
    Hotkey, %wildcardUndo%, UndoLastAction, UseErrorLevel
    Hotkey, %wildcardRedo%, RedoLastAction, UseErrorLevel

    ; Register copy+paste and paste hotkeys
    wildcardCopyPaste := "*" . HotkeyCopyPaste
    wildcardPaste := "*" . HotkeyPaste
    Hotkey, %wildcardCopyPaste%, CopyPasteHandler, UseErrorLevel
    Hotkey, %wildcardPaste%, PasteHandler, UseErrorLevel

    ; Register arrow key hotkeys
    wildcardLeft := "*" . HotkeyLeft
    wildcardRight := "*" . HotkeyRight
    wildcardUp := "*" . HotkeyUp
    wildcardDown := "*" . HotkeyDown
    Hotkey, %wildcardLeft%, LeftArrowHandler, UseErrorLevel
    Hotkey, %wildcardRight%, RightArrowHandler, UseErrorLevel
    Hotkey, %wildcardUp%, UpArrowHandler, UseErrorLevel
    Hotkey, %wildcardDown%, DownArrowHandler, UseErrorLevel

    ; Register toggle hotkey (always active, even when suspended)
    wildcardToggle := "*" . HotkeyToggle
    Hotkey, %wildcardToggle%, ToggleHotkeys, On UseErrorLevel

    ; Apply current hotkey state
    if (HotkeysEnabled)
        Suspend, Off
    else
        Suspend, On
}

; ===== CONFIGURATION GUI =====

^`::
Suspend, Permit  ; Allow this hotkey to work even when suspended
ShowConfigGUI()
return

ShowConfigGUI() {
    global

    ; Suspend all hotkeys while GUI is open
    Suspend, On

    Gui, Destroy

    ; Preset selector row
    Gui, Add, Text, x10 y10 w50, Preset:
    Gui, Add, DropDownList, x70 y10 w150 vGuiPresetSelector gPresetChanged, % PresetListToString()
    Gui, Add, Button, x230 y8 w60 h24 gNewPreset, New
    Gui, Add, Button, x295 y8 w60 h24 gRenamePreset, Rename
    Gui, Add, Button, x360 y8 w60 h24 gDeletePreset, Delete
    Gui, Add, Button, x730 y8 w30 h24 gShowHelp, ?

    ; EDO and Undo/Redo row
    Gui, Add, Text, x10 y45 w100, Current EDO:
    Gui, Add, Edit, x120 y45 w60 vGuiEDO, %CurrentEDO%

    Gui, Add, Text, x200 y45 w80, Sleep Delay (ms):
    Gui, Add, Edit, x290 y45 w40 vGuiSleepDelay, %SleepDelay%
    Gui, Font, s7
    Gui, Add, Text, x200 y72 w200 cGray, (increase if DAW is buggy)
    Gui, Font

    Gui, Add, Text, x350 y45 w60, Undo Key:
    Gui, Add, Hotkey, x420 y45 w120 vGuiHotkeyUndo, %HotkeyUndo%
    Gui, Add, Text, x560 y45 w60, Redo Key:
    Gui, Add, Hotkey, x620 y45 w120 vGuiHotkeyRedo, %HotkeyRedo%

    Gui, Add, Text, x350 y75 w60, Toggle Key:
    Gui, Add, Hotkey, x420 y75 w120 vGuiHotkeyToggle, %HotkeyToggle%
    Gui, Font, s7
    Gui, Add, Text, x560 y75 w200 cGray, (press to enable/disable hotkeys)
    Gui, Font

    Gui, Add, Text, x10 y100 w80, Copy+Paste:
    Gui, Add, Hotkey, x95 y100 w120 vGuiHotkeyCopyPaste -E0x200, %HotkeyCopyPaste%
    Gui, Add, Text, x230 y100 w60, Paste:
    Gui, Add, Hotkey, x280 y100 w120 vGuiHotkeyPaste -E0x200, %HotkeyPaste%

    Gui, Add, Text, x10 y125 w50, Left:
    Gui, Add, Hotkey, x60 y125 w60 vGuiHotkeyLeft, %HotkeyLeft%
    Gui, Add, Text, x130 y125 w50, Right:
    Gui, Add, Hotkey, x180 y125 w60 vGuiHotkeyRight, %HotkeyRight%
    Gui, Add, Text, x250 y125 w50, Up:
    Gui, Add, Hotkey, x300 y125 w60 vGuiHotkeyUp, %HotkeyUp%
    Gui, Add, Text, x370 y125 w50, Down:
    Gui, Add, Hotkey, x420 y125 w60 vGuiHotkeyDown, %HotkeyDown%

    Gui, Add, Text, x10 y155 w300 Section, Slot 1:
    Gui, Add, Checkbox, x10 ys+25 w60 vGuiSlot1Enabled Checked%Slot1Enabled%, Enabled
    Gui, Add, Text, x80 ys+25 w60, Interval:
    Gui, Add, Edit, x150 ys+25 w80 vGuiInterval1, %Interval1%
    Gui, Add, Text, x250 ys+25 w60, Up Key:
    Gui, Add, Hotkey, x320 ys+25 w120 vGuiHotkey1Up, %Hotkey1Up%
    Gui, Add, Text, x450 ys+25 w70, Down Key:
    Gui, Add, Hotkey, x530 ys+25 w120 vGuiHotkey1Down, %Hotkey1Down%

    Gui, Add, Text, x10 ys+60 w300 Section, Slot 2:
    Gui, Add, Checkbox, x10 ys+25 w60 vGuiSlot2Enabled Checked%Slot2Enabled%, Enabled
    Gui, Add, Text, x80 ys+25 w60, Interval:
    Gui, Add, Edit, x150 ys+25 w80 vGuiInterval2, %Interval2%
    Gui, Add, Text, x250 ys+25 w60, Up Key:
    Gui, Add, Hotkey, x320 ys+25 w120 vGuiHotkey2Up, %Hotkey2Up%
    Gui, Add, Text, x450 ys+25 w70, Down Key:
    Gui, Add, Hotkey, x530 ys+25 w120 vGuiHotkey2Down, %Hotkey2Down%

    Gui, Add, Text, x10 ys+60 w300 Section, Slot 3:
    Gui, Add, Checkbox, x10 ys+25 w60 vGuiSlot3Enabled Checked%Slot3Enabled%, Enabled
    Gui, Add, Text, x80 ys+25 w60, Interval:
    Gui, Add, Edit, x150 ys+25 w80 vGuiInterval3, %Interval3%
    Gui, Add, Text, x250 ys+25 w60, Up Key:
    Gui, Add, Hotkey, x320 ys+25 w120 vGuiHotkey3Up, %Hotkey3Up%
    Gui, Add, Text, x450 ys+25 w70, Down Key:
    Gui, Add, Hotkey, x530 ys+25 w120 vGuiHotkey3Down, %Hotkey3Down%

    Gui, Add, Text, x10 ys+60 w300 Section, Slot 4:
    Gui, Add, Checkbox, x10 ys+25 w60 vGuiSlot4Enabled Checked%Slot4Enabled%, Enabled
    Gui, Add, Text, x80 ys+25 w60, Interval:
    Gui, Add, Edit, x150 ys+25 w80 vGuiInterval4, %Interval4%
    Gui, Add, Text, x250 ys+25 w60, Up Key:
    Gui, Add, Hotkey, x320 ys+25 w120 vGuiHotkey4Up, %Hotkey4Up%
    Gui, Add, Text, x450 ys+25 w70, Down Key:
    Gui, Add, Hotkey, x530 ys+25 w120 vGuiHotkey4Down, %Hotkey4Down%

    Gui, Add, Text, x10 ys+60 w300 Section, Slot 5:
    Gui, Add, Checkbox, x10 ys+25 w60 vGuiSlot5Enabled Checked%Slot5Enabled%, Enabled
    Gui, Add, Text, x80 ys+25 w60, Interval:
    Gui, Add, Edit, x150 ys+25 w80 vGuiInterval5, %Interval5%
    Gui, Add, Text, x250 ys+25 w60, Up Key:
    Gui, Add, Hotkey, x320 ys+25 w120 vGuiHotkey5Up, %Hotkey5Up%
    Gui, Add, Text, x450 ys+25 w70, Down Key:
    Gui, Add, Hotkey, x530 ys+25 w120 vGuiHotkey5Down, %Hotkey5Down%

    Gui, Add, Text, x10 ys+60 w300 Section, Slot 6:
    Gui, Add, Checkbox, x10 ys+25 w60 vGuiSlot6Enabled Checked%Slot6Enabled%, Enabled
    Gui, Add, Text, x80 ys+25 w60, Interval:
    Gui, Add, Edit, x150 ys+25 w80 vGuiInterval6, %Interval6%
    Gui, Add, Text, x250 ys+25 w60, Up Key:
    Gui, Add, Hotkey, x320 ys+25 w120 vGuiHotkey6Up, %Hotkey6Up%
    Gui, Add, Text, x450 ys+25 w70, Down Key:
    Gui, Add, Hotkey, x530 ys+25 w120 vGuiHotkey6Down, %Hotkey6Down%

    Gui, Add, Text, x10 ys+60 w300 Section, Slot 7:
    Gui, Add, Checkbox, x10 ys+25 w60 vGuiSlot7Enabled Checked%Slot7Enabled%, Enabled
    Gui, Add, Text, x80 ys+25 w60, Interval:
    Gui, Add, Edit, x150 ys+25 w80 vGuiInterval7, %Interval7%
    Gui, Add, Text, x250 ys+25 w60, Up Key:
    Gui, Add, Hotkey, x320 ys+25 w120 vGuiHotkey7Up, %Hotkey7Up%
    Gui, Add, Text, x450 ys+25 w70, Down Key:
    Gui, Add, Hotkey, x530 ys+25 w120 vGuiHotkey7Down, %Hotkey7Down%

    Gui, Add, Button, x280 ys+70 w80 h30 gSaveConfigButton, Save
    Gui, Add, Button, x370 ys+70 w80 h30 gCancelButton, Cancel
    Gui, Add, Text, x480 ys+77 w280 cGray, Press Ctrl+` (tilde) to open this config

    Gui, Show, w760 h635, MIDI Interval Macro Configuration
}

; Helper function to convert preset list to dropdown string
PresetListToString() {
    global PresetList, CurrentPreset
    result := ""
    for index, preset in PresetList {
        if (preset = CurrentPreset)
            result .= (result != "" ? "|" : "") . preset . "|"
        else
            result .= (result != "" ? "|" : "") . preset
    }
    return result
}

PresetChanged:
    Gui, Submit, NoHide
    if (GuiPresetSelector != CurrentPreset) {
        LoadPreset(GuiPresetSelector)
        ; Refresh GUI with new preset data
        ShowConfigGUI()
    }
return

NewPreset:
    InputBox, newPresetName, New Preset, Enter name for new preset:
    if (ErrorLevel = 0 && newPresetName != "") {
        ; Check if preset already exists
        presetExists := false
        for index, preset in PresetList {
            if (preset = newPresetName) {
                presetExists := true
                break
            }
        }
        if (presetExists) {
            MsgBox, Preset "%newPresetName%" already exists!
        } else {
            PresetList.Push(newPresetName)
            CurrentPreset := newPresetName
            SaveConfig()
            ShowConfigGUI()
        }
    }
return

RenamePreset:
    InputBox, newName, Rename Preset, Enter new name for preset "%CurrentPreset%":
    if (ErrorLevel = 0 && newName != "" && newName != CurrentPreset) {
        ; Check if new name already exists
        nameExists := false
        for index, preset in PresetList {
            if (preset = newName) {
                nameExists := true
                break
            }
        }
        if (nameExists) {
            MsgBox, Preset "%newName%" already exists!
        } else {
            ; Delete old section
            oldSection := "Preset_" . CurrentPreset
            IniDelete, %ConfigFile%, %oldSection%

            ; Update preset list
            for index, preset in PresetList {
                if (preset = CurrentPreset) {
                    PresetList[index] := newName
                    break
                }
            }
            CurrentPreset := newName
            SaveConfig()
            ShowConfigGUI()
        }
    }
return

DeletePreset:
    if (PresetList.Length() <= 1) {
        MsgBox, Cannot delete the last preset!
        return
    }

    MsgBox, 4, Delete Preset, Are you sure you want to delete preset "%CurrentPreset%"?
    IfMsgBox, Yes
    {
        ; Delete section from INI
        section := "Preset_" . CurrentPreset
        IniDelete, %ConfigFile%, %section%

        ; Remove from preset list
        for index, preset in PresetList {
            if (preset = CurrentPreset) {
                PresetList.RemoveAt(index)
                break
            }
        }

        ; Switch to first available preset
        CurrentPreset := PresetList[1]
        LoadPreset(CurrentPreset)
        SaveConfig()
        ShowConfigGUI()
    }
return

ShowHelp:
    Gui, Help:Destroy
    Gui, Help:Add, Text, x10 y10 w550, MIDI Interval Macro - Help
    Gui, Help:Add, Text, x10 y40 w550,
    (LTrim
        === PRESETS ===
        Presets allow you to save multiple configurations with different:
        - EDO settings (Equal Divisions of the Octave)
        - Interval ratios (musical intervals like 3/2, 5/4, etc.)
        - Hotkey mappings

        • New: Create a new preset with default settings
        • Rename: Rename the current preset
        • Delete: Delete the current preset (requires at least 1 preset)
        • Dropdown: Switch between presets instantly

        === INTERVALS ===
        Each slot can have an interval defined as a ratio (e.g., 3/2 for perfect fifth)
        or as a decimal (e.g., 1.5). The script calculates the closest EDO step.

        === HOTKEYS ===
        Click in any hotkey field and press your desired key combination.
        The script supports:
        - Numpad keys (recommended to avoid conflicts)
        - Modified keys (Ctrl, Shift, Alt + key)
        - Arrow keys and function keys

        === UNDO/REDO ===
        The script tracks every interval movement and allows you to:
        - Undo: Reverses the last interval action (sends Ctrl+Z)
        - Redo: Re-applies an undone action (sends Ctrl+Y)
        History is limited to the last 100 actions.

        === USAGE ===
        1. Configure your intervals and hotkeys
        2. Save your settings (automatically saved to current preset)
        3. Close the config window
        4. Use your hotkeys in your DAW to move notes by intervals
        5. Press Ctrl+` to reopen this configuration window
    )
    Gui, Help:Add, Button, x230 y490 w80 h30 gHelpClose, Close
    Gui, Help:Show, w570 h540, MIDI Interval Macro - Help
return

HelpClose:
HelpGuiClose:
HelpGuiEscape:
    Gui, Help:Destroy
return

SaveConfigButton:
    Gui, Submit, NoHide

    CurrentEDO := GuiEDO
    SleepDelay := GuiSleepDelay
    Slot1Enabled := GuiSlot1Enabled
    Slot2Enabled := GuiSlot2Enabled
    Slot3Enabled := GuiSlot3Enabled
    Slot4Enabled := GuiSlot4Enabled
    Slot5Enabled := GuiSlot5Enabled
    Slot6Enabled := GuiSlot6Enabled
    Slot7Enabled := GuiSlot7Enabled
    Interval1 := GuiInterval1
    Interval2 := GuiInterval2
    Interval3 := GuiInterval3
    Interval4 := GuiInterval4
    Interval5 := GuiInterval5
    Interval6 := GuiInterval6
    Interval7 := GuiInterval7

    ; Hotkey controls already return proper AHK notation
    Hotkey1Up := GuiHotkey1Up
    Hotkey1Down := GuiHotkey1Down
    Hotkey2Up := GuiHotkey2Up
    Hotkey2Down := GuiHotkey2Down
    Hotkey3Up := GuiHotkey3Up
    Hotkey3Down := GuiHotkey3Down
    Hotkey4Up := GuiHotkey4Up
    Hotkey4Down := GuiHotkey4Down
    Hotkey5Up := GuiHotkey5Up
    Hotkey5Down := GuiHotkey5Down
    Hotkey6Up := GuiHotkey6Up
    Hotkey6Down := GuiHotkey6Down
    Hotkey7Up := GuiHotkey7Up
    Hotkey7Down := GuiHotkey7Down

    HotkeyUndo := GuiHotkeyUndo
    HotkeyRedo := GuiHotkeyRedo
    HotkeyCopyPaste := GuiHotkeyCopyPaste
    HotkeyPaste := GuiHotkeyPaste
    HotkeyLeft := GuiHotkeyLeft
    HotkeyRight := GuiHotkeyRight
    HotkeyUp := GuiHotkeyUp
    HotkeyDown := GuiHotkeyDown
    HotkeyToggle := GuiHotkeyToggle

    SaveConfig()
    RegisterHotkeys()

    Gui, Destroy
    ; Restore previous hotkey state
    if (HotkeysEnabled)
        Suspend, Off
    else
        Suspend, On
    ToolTip, Configuration saved!
    SetTimer, RemoveToolTip, 2000
return

CancelButton:
GuiClose:
GuiEscape:
    Gui, Destroy
    ; Restore previous hotkey state
    if (HotkeysEnabled)
        Suspend, Off
    else
        Suspend, On
return

RemoveToolTip:
    SetTimer, RemoveToolTip, Off
    ToolTip
return


; ===== INTERVAL HANDLERS =====

Interval1Up_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval1)
    MoveBySteps(steps, "up")
return

Interval1Down_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval1)
    MoveBySteps(steps, "down")
return

Interval2Up_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval2)
    MoveBySteps(steps, "up")
return

Interval2Down_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval2)
    MoveBySteps(steps, "down")
return

Interval3Up_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval3)
    MoveBySteps(steps, "up")
return

Interval3Down_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval3)
    MoveBySteps(steps, "down")
return

Interval4Up_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval4)
    MoveBySteps(steps, "up")
return

Interval4Down_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval4)
    MoveBySteps(steps, "down")
return

Interval5Up_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval5)
    MoveBySteps(steps, "up")
return

Interval5Down_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval5)
    MoveBySteps(steps, "down")
return

Interval6Up_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval6)
    MoveBySteps(steps, "up")
return

Interval6Down_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval6)
    MoveBySteps(steps, "down")
return

Interval7Up_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval7)
    MoveBySteps(steps, "up")
return

Interval7Down_Handler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    steps := CalculateInterval(Interval7)
    MoveBySteps(steps, "down")
return

; ===== COPY+PASTE AND PASTE HANDLERS =====

CopyPasteHandler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    Send ^c
    Sleep 10
    Send ^v
return

PasteHandler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    Send ^v
return

; ===== ARROW KEY HANDLERS =====

LeftArrowHandler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    if GetKeyState("Shift", "P")
        Send +{Left}
    else
        Send {Left}
return

RightArrowHandler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    if GetKeyState("Shift", "P")
        Send +{Right}
    else
        Send {Right}
return

UpArrowHandler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    Send {Up}
return

DownArrowHandler:
    if HasModifierHeld() {
        PassthroughKey()
        return
    }
    Send {Down}
return

; ===== TOGGLE HOTKEYS HANDLER =====

ToggleHotkeys:
Suspend, Permit  ; Allow this hotkey to work even when suspended
global HotkeysEnabled
HotkeysEnabled := !HotkeysEnabled

if (HotkeysEnabled) {
    Suspend, Off
    ToolTip, MIDI Hotkeys ENABLED
} else {
    Suspend, On
    ToolTip, MIDI Hotkeys DISABLED
}
SetTimer, RemoveToolTip, 1500
return
