from setuptools import setup, find_packages

setup(
    name="envelo-agent",
    version="1.0.0",
    author="Sentinel Authority",
    author_email="conformance@sentinelauthority.org",
    description="ENVELO Agent - Runtime enforcement for autonomous systems",
    url="https://sentinelauthority.org",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=["httpx>=0.24.0"],
)
