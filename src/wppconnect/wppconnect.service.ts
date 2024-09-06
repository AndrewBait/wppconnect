import { Injectable } from '@nestjs/common';
import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import axios from 'axios';
import { Subject } from 'rxjs';

@Injectable()
export class WppconnectService {
  private sessions: Map<string, Whatsapp> = new Map();
  private qrCodes: Map<string, Buffer> = new Map();
  private newMessageSubject = new Subject<any>();
  private eventSubject = new Subject<any>();
  private eventCache: Map<string, any> = new Map();

  async createSession(sessionName: string): Promise<void> {
    if (this.sessions.has(sessionName)) {
      console.log(`Sessão ${sessionName} já está ativa.`);
      return;
    }

    const client = await create({
      session: sessionName,
      headless: true,
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      catchQR: (base64Qr, asciiQR) => this.handleQRCode(sessionName, base64Qr, asciiQR),
      logQR: false,
    });

    this.sessions.set(sessionName, client);

    client.onAnyMessage((message) => this.onMessageReceived('message', sessionName, message));
    client.onStateChange((state) => this.onMessageReceived('state', sessionName, { state }));
    client.onAck((ack) => this.onMessageReceived('ack', sessionName, ack));
    client.onIncomingCall((call) => this.onMessageReceived('call', sessionName, call));

    console.log(`Sessão ${sessionName} criada com sucesso.`);
  }

  private handleQRCode(sessionName: string, base64Qr: string, asciiQR: string) {
    console.log(`QR Code recebido para sessão ${sessionName}: ${asciiQR}`);
    const matches = base64Qr.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error('String base64 inválida para QR Code');
      return;
    }
    const imageBuffer = Buffer.from(matches[2], 'base64');
    this.qrCodes.set(sessionName, imageBuffer);
  }

  private onMessageReceived(eventType: string, sessionName: string, event: any) {
    const formattedEvent = this.formatEvent(eventType, sessionName, event);
    console.log(`[${sessionName}] Evento recebido:`, formattedEvent);

    this.eventSubject.next(formattedEvent);
    this.sendEvent(formattedEvent);
  }

  private formatEvent(eventType: string, sessionName: string, event: any): any {
    const formattedEvent: any = {
        tipoDeEvento: eventType,
        nomeDaSessao: sessionName,
        timestamp: new Date().toLocaleString(),
        dados: {},
    };

    switch (eventType) {
        case 'message':
            formattedEvent.dados = this.formatMessageEvent(event);
            break;
        case 'ack':
            formattedEvent.dados = this.formatAckEvent(event);
            break;
        case 'state':
          formattedEvent.dados = {
            estado: event.state,
            descricao: this.getStateDescription(event.state), // Descrição do estado
          };
          break;
        case 'call':
            formattedEvent.dados = this.formatCallEvent(event);
            break;
        default:
            formattedEvent.dados = event;
    }

    return JSON.stringify(formattedEvent, null, 2);  // Mantém o JSON formatado
}

  private getStateDescription(state: string): string {
    switch (state) {
      case 'CONNECTED':
        return 'Conectado';
      case 'DISCONNECTED':
        return 'Desconectado';
      case 'TIMEOUT':
        return 'Tempo esgotado';
      default:
        return 'Estado desconhecido';
    }
  }
  

  private formatMessageEvent(event: any): any {
      const baseData = {
          id: event.id,
          tipo: event.type,
          de: event.from,
          para: event.to,
          timestamp: new Date(event.t * 1000).toLocaleString(),  
          enviadoPorMim: event.fromMe ? 'Sim' : 'Não',
          remetente: event.sender ? {
              id: event.sender.id,
              nome: event.sender.name,
              apelido: event.sender.pushname,
              nomeFormatado: event.sender.formattedName,
          } : {},
      };

      switch (event.type) {
          case 'location':
              return {
                  ...baseData,
                  tipo: 'Localização',
                  localizacao: {
                      latitude: event.lat,
                      longitude: event.lng,
                  },
              };
          case 'vcard':
              return {
                  ...baseData,
                  tipo: 'vCard (Contato)',
                  contato: this.parseVCard(event.body),
              };
          case 'ptt':
          case 'audio':
              return {
                  ...baseData,
                  tipo: 'Áudio (ptt)',
                  dadosDeMidia: this.extractMediaData(event),
              };
          case 'image':
              return {
                  ...baseData,
                  tipo: 'Imagem',
                  dadosDeMidia: this.extractMediaData(event),
              };
          case 'text':
            return {
              ...baseData,
              visualizado: event.viewed ? 'Sim' : 'Não',
              corpo: event.body,
              emojis: this.extractEmojis(event.body),  // Extrai emojis
            };
          default:
            return {
              ...baseData,
              visualizado: event.viewed ? 'Sim' : 'Não',
              corpo: event.body,
            };
        }
      }


  private extractEmojis(text: string): string[] {
    // Função para extrair emojis de um texto
    const regex = /([\u2600-\u26FF]|[\u2700-\u27BF]|[\u1F300-\u1F5FF]|[\u1F600-\u1F64F]|[\u1F680-\u1F6FF]|[\u1F700-\u1F77F]|[\u1F780-\u1F7FF]|[\u1F800-\u1F8FF]|[\u1F900-\u1F9FF]|[\u1FA00-\u1FA6F]|[\u1FA70-\u1FAFF])/g;
    return text.match(regex) || [];
  }


  private extractMediaData(event: any) {
      return {
          mimetype: event.mediaData?.mimetype || 'Não especificado',
          tamanho: event.mediaData?.size ? `${event.mediaData.size} bytes` : 'Indefinido',
          caminhoDireto: event.mediaData?.directPath || 'Não disponível',
      };
  }

  private formatAckEvent(event: any): any {
    return {
        id: event.id?._serialized,
        de: event.from,
        para: event.to,
        confirmacao: this.getAckDescription(event.ack),  // Mostra a descrição do status de confirmação
        timestamp: new Date(event.t * 1000).toLocaleString(),  // Converte o timestamp para formato legível
    };
}

private getAckDescription(ack: number): string {
    switch (ack) {
        case 0:
            return 'Mensagem enviada (pendente)';
        case 1:
            return 'Mensagem entregue ao servidor';
        case 2:
            return 'Mensagem entregue ao destinatário';
        case 3:
            return 'Mensagem lida pelo destinatário';
        default:
            return 'Status desconhecido';
    }
}


  private formatCallEvent(event: any): any {
      return {
          id: event.id,
          peerJid: event.peerJid,
          tempoDeOferta: event.offerTime,
          video: event.isVideo ? 'Sim' : 'Não',
          grupo: event.isGroup ? 'Sim' : 'Não',
          chamadaPerdida: event.isMissedCall ? 'Sim' : 'Não', 
      };
  }

  private async sendEvent(event: any): Promise<void> {
    const cacheKey = `${event.nomeDaSessao}-${event.tipoDeEvento}`;
    
    if (this.eventCache.has(cacheKey)) {
      console.log(`Evento já processado recentemente: ${cacheKey}`);
      return;
    }

    this.eventCache.set(cacheKey, event);
    setTimeout(() => this.eventCache.delete(cacheKey), 60000);

  try {
    await axios.post('http://localhost:3000/whatsapp/events', event, { timeout: 10000 });
  } catch (error) {
    console.error(`Erro ao enviar o evento:`, error.message);
    if (error.code === 'ECONNABORTED' || error.message.includes('socket hang up')) {
      console.log('Tentativa de nova conexão devido a falha de socket.');
      setTimeout(() => this.retrySendEvent(event), 5000);
    } else {
      console.log('Erro inesperado ao enviar evento:', error.response?.data || error.message);
    }
  }
  }

  private async retrySendEvent(event: any): Promise<void> {
    try {
      await axios.post('http://localhost:3000/whatsapp/events', event, { timeout: 20000 });
    } catch (retryError) {
      console.error('Erro ao tentar novamente:', retryError.message);
    }
  }

  // Função para extrair informações do vCard
  private parseVCard(vcardString: string): any {
    const lines = vcardString.split('\n');
    const contactInfo: any = {};

    lines.forEach((line) => {
      if (line.startsWith('FN:')) {
        contactInfo.nomeCompleto = line.replace('FN:', '').trim();
      } else if (line.startsWith('TEL;')) {
        const match = line.match(/waid=(\d+):(.+)/);
        if (match) {
          contactInfo.telefone = match[2].trim();
        }
      } else if (line.startsWith('N:')) {
        contactInfo.nome = line.replace('N:', '').trim();
      }
    });

    return contactInfo;
  }
  async removeSession(sessionName: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }
    await client.close(); 
    this.sessions.delete(sessionName); // Remove do mapa de sessões
    this.qrCodes.delete(sessionName); // Remove o QR code armazenado, se houver
    console.log(`Sessão ${sessionName} removida com sucesso.`);
  }

  async getQRCodeImage(sessionName: string): Promise<Buffer> {
    const qrCodeImage = this.qrCodes.get(sessionName);
    if (!qrCodeImage) {
      throw new Error(`QR Code para a sessão ${sessionName} não encontrado ou sessão já autenticada.`);
    }
    return qrCodeImage; // Retorna o buffer da imagem
  }

  async sendMessage(sessionName: string, to: string, message: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }

    await client.sendText(to, message);
    console.log(`[${sessionName}] Mensagem enviada para ${to}: ${message}`);
  }

  // Novas funções para enviar diferentes tipos de mensagens
  async sendContactVcard(sessionName: string, to: string, contact: string, name: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }

    await client.sendContactVcard(to, contact, name);
  }

  async sendLocation(sessionName: string, to: string, lat: string, long: string, name: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }

    await client.sendLocation(to, lat, long, name);
  }

  getSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  async getSessionStatus(sessionName: string): Promise<string> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      return `Sessão ${sessionName} não encontrada.`;
    }
    return await client.getConnectionState(); // Retorna o estado de conexão da sessão
  }

  async reconnectSession(sessionName: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }

    await client.close(); 
    this.sessions.delete(sessionName); // Remove do mapa de sessões

    await this.createSession(sessionName); // Cria uma nova sessão com o mesmo nome
  }
}
