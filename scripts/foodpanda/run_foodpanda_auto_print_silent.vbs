Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c ""cd /d " & WshShell.CurrentDirectory & " && python foodpanda_auto_print.py""", 0, False
