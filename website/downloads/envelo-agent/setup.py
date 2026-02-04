from setuptools import setup, find_packages

setup(
    name="envelo",
    version="2.0.0",
    description="ENVELO — Enforced Non-Violable Execution-Limit Override Agent",
    long_description=open("README.md").read() if __import__("os").path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    author="Sentinel Authority",
    author_email="conformance@sentinelauthority.org",
    url="https://sentinelauthority.org",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=["httpx>=0.24.0"],
    extras_require={"yaml": ["PyYAML>=6.0"]},
    entry_points={
        "console_scripts": [
            "envelo=envelo.cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
