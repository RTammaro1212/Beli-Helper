use scripting additions

on run
    set processName to "iPhone Mirroring"

    tell application "System Events" to set processIsRunning to exists process processName
    if not processIsRunning then
        do shell script "/usr/bin/open -a 'iPhone Mirroring'"

        repeat 50 times
            tell application "System Events" to set processIsRunning to exists process processName
            if processIsRunning then exit repeat
            delay 0.2
        end repeat
    end if

    if not processIsRunning then
        error "iPhone Mirroring did not open."
    end if

    tell application "System Events"
        tell process processName
            set frontmost to true

            repeat 50 times
                if exists window 1 then exit repeat
                delay 0.2
            end repeat

            if not (exists window 1) then
                error "No iPhone Mirroring window was found."
            end if

            set {windowX, windowY} to position of window 1
            set {windowWidth, windowHeight} to size of window 1
        end tell
    end tell

    delay 0.3

    set desktopPath to POSIX path of (path to desktop folder)
    set timestamp to do shell script "/bin/date '+%Y-%m-%d_%H-%M-%S'"
    set outputPath to desktopPath & "iphone-mirroring-" & timestamp & ".png"
    set captureRegion to (windowX as text) & "," & (windowY as text) & "," & (windowWidth as text) & "," & (windowHeight as text)

    do shell script "/usr/sbin/screencapture -x -R" & quoted form of captureRegion & space & quoted form of outputPath

    return outputPath
end run
