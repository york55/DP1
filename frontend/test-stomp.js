import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const wsUrl = 'http://localhost:8080/ws';

const client = new Client({
  webSocketFactory: () => new SockJS(wsUrl),
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
});

client.onConnect = () => {
  console.log('Connected to STOMP');
  client.subscribe('/topic/simulation/1/tick', (msg) => {
    console.log('Received tick:', msg.body.substring(0, 100));
  });
  client.subscribe('/topic/alerts', (msg) => {
    console.log('Received alert:', msg.body);
  });
};

client.onStompError = (frame) => {
  console.error('Broker reported error: ' + frame.headers['message']);
  console.error('Additional details: ' + frame.body);
};

client.activate();
console.log('Activating STOMP client...');
