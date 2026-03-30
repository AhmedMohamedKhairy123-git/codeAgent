import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

class GitNexusAnalyzer:
    """
    GitNexus Deep Analysis Engine.
    Uses Microsoft CodeBERT for semantic code understanding.
    """
    def __init__(self):
        # This specific line triggers a 2GB+ download automatically
        self.model_ckpt = "microsoft/codebert-base"
        print(f"[*] Loading SOTA Model: {self.model_ckpt}...")
        
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_ckpt)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_ckpt)
        print("[+] Deep Intelligence Engine Loaded.")

    def analyze(self, code_text):
        # Processes the code through the neural network
        inputs = self.tokenizer(code_text, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad():
            return self.model(**inputs)