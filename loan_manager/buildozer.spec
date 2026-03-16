[app]

# (str) Title of your application
title = 黄金分期管理系统

# (str) Package name
package.name = loanmanager

# (str) Package domain (needed for android/ios packaging)
package.domain = com.loanmanager

# (str) Source code where the main.py lives
source.dir = mobile_client

# (str) Application entry point
source.main = main.py

# (list) Source files to include
source.include_exts = py,png,jpg,kv,atlas,json,ttf,otf

# (str) Application versioning
version = 1.0.0

# (list) Application requirements
requirements = python3,kivy,requests,urllib3,charset-normalizer,idna,certifi,openpyxl

# (str) Supported orientation (landscape, sensorLandscape, portrait, sensorPortrait, all)
orientation = portrait

# (bool) Indicate if the application should be fullscreen
fullscreen = 0

# (int) Target Android API
android.api = 33

# (int) Minimum API required
android.minapi = 21

# (str) Android NDK version to use
android.ndk = 25b

# (list) Permissions
android.permissions = INTERNET,WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE

# (str) Android logcat filters
android.logcat_filters = *:S python:D

# (bool) Enable AndroidX support
android.enable_androidx = True

# (str) The format used to package the app for debug mode (aab or apk)
android.debug_artifact = apk

# (str) The format used to package the app for release mode (aab or apk)
android.release_artifact = apk

[buildozer]

# (int) Log level (0 = error only, 1 = info, 2 = debug)
log_level = 2

# (int) Display warning if buildozer is run as root
warn_on_root = 1
