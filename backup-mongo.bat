@echo off
set TIMESTAMP=%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set BACKUP_PATH=C:\backup\mongodb
set MONGODB_PATH="C:\Program Files\MongoDB\Server\6.0\bin"

%MONGODB_PATH%\mongodump --db delicato --out %BACKUP_PATH%\backup_%TIMESTAMP%

:: Keep only last 7 days of backups
forfiles /p %BACKUP_PATH% /d -7 /c "cmd /c if @isdir==TRUE rd /s /q @path"