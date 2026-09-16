' Lanca a ponte Treinos <-> Hermes sem janela. Corre de 5 em 5 min pela tarefa
' Treinos_IA_Hermes: se ja houver uma viva, a nova ve a porta ocupada e sai logo.
Set sh = CreateObject("WScript.Shell")
pasta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run """C:\Users\BBrito\nodejs\node.exe"" """ & pasta & "\ia_hermes.js""", 0, False
