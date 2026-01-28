"""
ENVELO SDK - Sentinel Authority Enforcement Agent
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

setup(
    name="envelo",
    version="1.0.0",
    author="Sentinel Authority",
    author_email="support@sentinelauthority.org",
    description="ENVELO - Enforcer for Non-Violable Execution & Limit Oversight",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://www.sentinelauthority.org",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: System :: Hardware",
        "License :: Other/Proprietary License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.25.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.20.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "envelo=envelo.cli:main",
        ],
    },
    keywords="autonomous systems, safety, enforcement, ODD, operational design domain, ENVELO",
    project_urls={
        "Documentation": "https://docs.sentinelauthority.org/envelo",
        "Source": "https://github.com/sentinelauthority/envelo-sdk",
        "Tracker": "https://github.com/sentinelauthority/envelo-sdk/issues",
    },
)
