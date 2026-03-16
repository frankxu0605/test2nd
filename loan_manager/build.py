"""PyInstaller build script for the client application."""
import PyInstaller.__main__
import os

base_dir = os.path.dirname(os.path.abspath(__file__))

PyInstaller.__main__.run([
    os.path.join(base_dir, "run_client.py"),
    "--name=黄金分期管理系统",
    "--onefile",
    "--windowed",
    "--noconfirm",
    "--clean",
    f"--distpath={os.path.join(base_dir, 'dist')}",
    f"--workpath={os.path.join(base_dir, 'build')}",
    f"--specpath={base_dir}",
])
