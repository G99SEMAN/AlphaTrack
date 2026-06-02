Set oWS = WScript.CreateObject("WScript.Shell")

' Pfad zum Projektordner (zwei Ebenen ueber diesem Script)
Dim scriptDir
scriptDir = oWS.CurrentDirectory
Dim projectRoot
projectRoot = oWS.ExpandEnvironmentStrings("%~dp0")

' Projektverzeichnis ermitteln: dieses Script liegt in scripts\windows\
Dim scriptPath
scriptPath = WScript.ScriptFullName
Dim scriptsWindowsDir
scriptsWindowsDir = Left(scriptPath, InStrRev(scriptPath, "\") - 1)
Dim scriptsDir
scriptsDir = Left(scriptsWindowsDir, InStrRev(scriptsWindowsDir, "\") - 1)
projectRoot = Left(scriptsDir, InStrRev(scriptsDir, "\") - 1)

Dim batPath
batPath = projectRoot & "\scripts\windows\AlphaTrack.bat"

Dim iconPath
iconPath = projectRoot & "\public\logo\alphatrack.ico"

' Pruefe ob AlphaTrack.bat existiert
If Not CreateObject("Scripting.FileSystemObject").FileExists(batPath) Then
  MsgBox "AlphaTrack.bat nicht gefunden." & vbCrLf & "Erwartet unter: " & batPath, vbExclamation, "AlphaTrack"
  WScript.Quit
End If

' Verknuepfung auf dem Desktop erstellen
Dim desktopPath
desktopPath = oWS.SpecialFolders("Desktop")

Dim oLink
Set oLink = oWS.CreateShortcut(desktopPath & "\AlphaTrack.lnk")
oLink.TargetPath = batPath
oLink.WorkingDirectory = projectRoot
oLink.WindowStyle = 1
oLink.Description = "AlphaTrack - Trading Journal starten"

If CreateObject("Scripting.FileSystemObject").FileExists(iconPath) Then
  oLink.IconLocation = iconPath
End If

oLink.Save

MsgBox "Desktop-Verknuepfung wurde erstellt!" & vbCrLf & vbCrLf & "Du findest 'AlphaTrack' jetzt auf deinem Desktop.", vbInformation, "AlphaTrack"
