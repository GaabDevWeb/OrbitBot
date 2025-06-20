import sys
import os
import whisper
import json
from datetime import datetime

def validate_audio_file(file_path):
    """Valida se o arquivo de áudio existe e é válido"""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")
    
    # Verifica extensões suportadas
    supported_extensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac']
    file_ext = os.path.splitext(file_path)[1].lower()
    
    if file_ext not in supported_extensions:
        raise ValueError(f"Formato não suportado: {file_ext}. Formatos suportados: {', '.join(supported_extensions)}")
    
    if os.path.getsize(file_path) == 0:
        raise ValueError("Arquivo vazio")

def transcribe_audio(file_path, model_name='small'):
    """Transcreve o áudio usando Whisper com configurações otimizadas"""
    try:
        # Valida o arquivo
        validate_audio_file(file_path)
        
        # Carrega o modelo
        print(f"Carregando modelo {model_name}...", file=sys.stderr)
        modelo = whisper.load_model(model_name)
        
        # Configurações de transcrição otimizadas para português brasileiro
        options = {
            "language": "pt",
            "task": "transcribe",
            "fp16": False,  # Mais compatível e preciso
            "verbose": False,
            "temperature": 0.0,  # Máxima consistência
            "best_of": 5,  # Testa 5 variações e pega a melhor
            "beam_size": 5,  # Busca mais ampla para melhor resultado
            "patience": 2,  # Paciência para encontrar melhor resultado
            "length_penalty": 1.0,  # Penaliza frases muito longas
            "suppress_tokens": [-1],  # Suprime tokens especiais
            "condition_on_previous_text": True,  # Usa contexto anterior
            "initial_prompt": "Transcrição em português brasileiro informal: "  # Dica inicial
        }
        
        print(f"Transcrevendo áudio: {os.path.basename(file_path)}", file=sys.stderr)
        
        # Faz a transcrição
        resultado = modelo.transcribe(file_path, **options)
        
        # Extrai o texto puro (sem correções manuais)
        texto = resultado['text'].strip()
        
        if not texto:
            raise ValueError("Transcrição resultou em texto vazio")
        
        # Log de sucesso
        print(f"Transcrição pura concluída: {len(texto)} caracteres", file=sys.stderr)
        print(f"Texto original: {texto}", file=sys.stderr)
        
        # Retorna apenas o texto puro do Whisper
        return texto
        
    except Exception as e:
        # Log de erro detalhado
        error_info = {
            "error": str(e),
            "file": file_path,
            "timestamp": datetime.now().isoformat(),
            "type": type(e).__name__
        }
        print(f"ERRO: {json.dumps(error_info)}", file=sys.stderr)
        raise

def main():
    if len(sys.argv) < 2:
        print("Uso: python transcrever_audio.py <caminho_do_audio> [modelo]", file=sys.stderr)
        print("Modelos disponíveis: tiny, base, small, medium, large", file=sys.stderr)
        sys.exit(1)
    
    caminho_audio = sys.argv[1]
    modelo = sys.argv[2] if len(sys.argv) > 2 else 'small'
    
    try:
        # Transcreve o áudio
        texto = transcribe_audio(caminho_audio, modelo)
        
        # Retorna apenas o texto transcrito
        print(texto)
        
    except Exception as e:
        print(f"Falha na transcrição: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 