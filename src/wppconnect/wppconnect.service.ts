import { Injectable } from '@nestjs/common';
import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import axios from 'axios';
import { Subject } from 'rxjs';


@Injectable()
export class WppconnectService {
  private sessions: Map<string, Whatsapp> = new Map();
  private qrCodes: Map<string, Buffer> = new Map();
  private newMessageSubject = new Subject<any>();
  private eventSubject = new Subject<any>(); // Gerenciador de eventos

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
      catchQR: (base64Qr, asciiQR) => {
        console.log(`QR Code recebido para sessão ${sessionName}: ${asciiQR}`);
        
        const matches = base64Qr.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          console.error('String base64 inválida para QR Code');
          return;
        }

        const imageBuffer = Buffer.from(matches[2], 'base64');
        this.qrCodes.set(sessionName, imageBuffer); // Armazena o buffer da imagem
      },
      logQR: false,
    });

    this.sessions.set(sessionName, client);

    // Captura eventos que existem na versão atual
    client.onAnyMessage((message) => this.handleEvent('message', sessionName, message));
    client.onStateChange((state) => this.handleEvent('state', sessionName, { state }));
    client.onAck((ack) => this.handleEvent('ack', sessionName, ack));
    client.onIncomingCall((call) => this.handleEvent('call', sessionName, call));

    console.log(`Sessão ${sessionName} criada com sucesso.`);
  }

  private async handleEvent(eventType: string, sessionName: string, event: any) {
    const formattedEvent = this.formatEvent({
      eventType,
      sessionName,
      event,
      timestamp: new Date().toLocaleString(),
    });

    console.log(`[${sessionName}] Evento recebido:`, formattedEvent);
    this.eventSubject.next(formattedEvent); // Emite o evento para o SSE

    
    try {
      // Adiciona uma lógica de tentativa novamente e configuração de timeout
      await axios.post('http://localhost:3000/whatsapp/events', formattedEvent, { timeout: 10000 }); // 10 segundos de timeout
    } catch (error) {
      console.error(`Erro ao enviar o evento para o endpoint da sessão ${sessionName}:`, error.message);

      if (error.response) {
        // O servidor respondeu com um status de erro (4xx, 5xx)
        console.error('Response error:', error.response.data);
      } else if (error.request) {
        // Nenhuma resposta foi recebida após a requisição ter sido feita
        console.error('Request error:', error.request);
      } else {
        // Erro ao configurar a requisição
        console.error('Error', error.message);
      }
  
      // Tentar novamente se for um erro de conexão de socket
      if (error.code === 'ECONNABORTED' || error.message.includes('socket hang up')) {
        console.log('Tentando novamente após erro de socket...');
        setTimeout(async () => {
          try {
            await axios.post('http://localhost:3000/whatsapp/events', formattedEvent, { timeout: 20000 });
          } catch (retryError) {
            console.error('Erro ao tentar novamente:', retryError.message);
          }
        }, 5000); // Tenta novamente após 5 segundos
      }
    }
  }

  onNewMessage() {
    return this.newMessageSubject.asObservable(); // Retorna o fluxo observável para SSE
  }

  onNewEvent() {
    return this.eventSubject.asObservable(); // Retorna o fluxo observável para eventos SSE
  }

  private formatEvent(event: any): string {
    const essentialData: any = {
      tipoDeEvento: event.eventType,  // traduzido para "tipoDeEvento"
      nomeDaSessao: event.sessionName, // traduzido para "nomeDaSessao"
      timestamp: event.timestamp, // mantém a timestamp no formato original
    };

    switch (event.eventType) {
      case 'message':
        if (event.event.type === 'location') {
          // Formatação de mensagem de localização
          essentialData.dados = {
            id: event.event.id,
            tipo: 'localização',
            de: event.event.from,
            para: event.event.to,
            timestamp: event.event.timestamp,
            enviadoPorMim: event.event.fromMe ? 'Sim' : 'Não',
            remetente: {
              id: event.event.sender?.id,
              nome: event.event.sender?.name,
              apelido: event.event.sender?.pushname,
              nomeFormatado: event.event.sender?.formattedName,
            },
            localizacao: {
              latitude: event.event.lat,
              longitude: event.event.lng,
            },
          };
        } else if (event.event.type === 'vcard') {
          // Formatação de mensagem do tipo "vcard"
          const vcardData = this.parseVCard(event.event.body);
          essentialData.dados = {
            id: event.event.id,
            tipo: 'vCard (Contato)',
            de: event.event.from,
            para: event.event.to,
            timestamp: event.event.timestamp,
            enviadoPorMim: event.event.fromMe ? 'Sim' : 'Não',
            remetente: {
              id: event.event.sender?.id,
              nome: event.event.sender?.name,
              apelido: event.event.sender?.pushname,
              nomeFormatado: event.event.sender?.formattedName,
            },
            contato: vcardData,  // Exibindo dados extraídos do vCard
          };
        } else if (event.event.type === 'ptt' || event.event.type === 'audio') {
          // Formatação de mensagem de áudio
          essentialData.dados = {
            id: event.event.id,
            tipo: 'Áudio (ptt)',
            de: event.event.from,
            para: event.event.to,
            timestamp: event.event.timestamp,
            enviadoPorMim: event.event.fromMe ? 'Sim' : 'Não',
            remetente: {
              id: event.event.sender?.id,
              nome: event.event.sender?.name,
              apelido: event.event.sender?.pushname,
              nomeFormatado: event.event.sender?.formattedName,
            },
            dadosDeMidia: {
              mimetype: event.event.mediaData?.mimetype || 'Não especificado',
              tamanho: event.event.mediaData?.size ? `${event.event.mediaData.size} bytes` : 'Indefinido',
              caminhoDireto: event.event.mediaData?.directPath || 'Não disponível',
            },
          };
        } else if (event.event.type === 'image') {
          // Formatação de mensagem de imagem
          essentialData.dados = {
            id: event.event.id,
            tipo: 'Imagem',
            de: event.event.from,
            para: event.event.to,
            timestamp: event.event.timestamp,
            enviadoPorMim: event.event.fromMe ? 'Sim' : 'Não',
            remetente: {
              id: event.event.sender?.id,
              nome: event.event.sender?.name,
              apelido: event.event.sender?.pushname,
              nomeFormatado: event.event.sender?.formattedName,
            },
            dadosDeMidia: {
              mimetype: event.event.mediaData?.mimetype || 'Não especificado',
              tamanho: event.event.mediaData?.size ? `${event.event.mediaData.size} bytes` : 'Indefinido',
              caminhoDireto: event.event.mediaData?.directPath || 'Não disponível',
            },
          };
        } else {
          // Caso de mensagem normal
          essentialData.dados = {
            id: event.event.id,
            visualizado: event.event.viewed ? 'Sim' : 'Não',
            corpo: event.event.body,
            tipo: event.event.type,
            de: event.event.from,
            para: event.event.to,
            timestamp: event.event.timestamp,
            enviadoPorMim: event.event.fromMe ? 'Sim' : 'Não',
            remetente: {
              id: event.event.sender?.id,
              nome: event.event.sender?.name,
              apelido: event.event.sender?.pushname,
              nomeFormatado: event.event.sender?.formattedName,
            },
            dadosDeMidia: event.event.mediaData ? {
              mimetype: event.event.mimetype,
              tamanho: `${event.event.size} bytes`,
              caminhoDireto: event.event.directPath,
            } : null,
          };
        }
        break;
  
  
      case 'ack':
        essentialData.dados = {  // traduzido para "dados"
          id: event.event.id?._serialized,
          de: event.event.from,
          para: event.event.to,
          ack: event.event.ack,
          timestamp: event.event.timestamp,
        };
        break;
  
      case 'state':
        essentialData.dados = { estado: event.event.state };  // traduzido para "estado"
        break;
  
      case 'incomingCall':
        essentialData.dados = {
          id: event.event.id,
          peerJid: event.event.peerJid,
          tempoDeOferta: event.event.offerTime,  // traduzido para "tempoDeOferta"
          video: event.event.isVideo ? 'Sim' : 'Não',  // traduzido para "video"
          grupo: event.event.isGroup ? 'Sim' : 'Não',  // traduzido para "grupo"
        };
        break;
  
      default:
        essentialData.dados = event.event;
    }
  
    return JSON.stringify(essentialData, null, 2);
  }

    // Função para extrair informações do vCard
  private parseVCard(vcardString: string): any {
    const lines = vcardString.split('\n');
    const contactInfo: any = {};

    lines.forEach((line) => {
      if (line.startsWith('FN:')) {
        contactInfo.nomeCompleto = line.replace('FN:', '').trim();  // Extrai nome completo
      } else if (line.startsWith('TEL;')) {
        const match = line.match(/waid=(\d+):(.+)/);
        if (match) {
          contactInfo.telefone = match[2].trim();  // Extrai número de telefone
        }
      } else if (line.startsWith('N:')) {
        contactInfo.nome = line.replace('N:', '').trim();  // Extrai nome
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
