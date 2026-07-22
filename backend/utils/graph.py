from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Set, Tuple
import networkx as nx

class TransactionGraph:
    def __init__(self):
        self.adj: Dict[str, List[Tuple[str, float, datetime]]] = defaultdict(list)
        self.reverse_adj: Dict[str, List[Tuple[str, float, datetime]]] = defaultdict(list)
        self.transactions: List[dict] = []
        self.nodes: Set[str] = set()

    def add_transaction(self, sender: str, receiver: str, amount: float, timestamp: datetime):
        self.transactions.append({
            'sender': sender,
            'receiver': receiver,
            'amount': amount,
            'timestamp': timestamp
        })
        self.adj[sender].append((receiver, amount, timestamp))
        self.reverse_adj[receiver].append((sender, amount, timestamp))
        self.nodes.add(sender)
        self.nodes.add(receiver)

    def get_outgoing(self, node: str) -> List[Tuple[str, float, datetime]]:
        return self.adj.get(node, [])

    def get_incoming(self, node: str) -> List[Tuple[str, float, datetime]]:
        return self.reverse_adj.get(node, [])

    def to_networkx(self, multi: bool = True) -> nx.MultiDiGraph | nx.DiGraph:
        """Converts to a NetworkX graph. Uses MultiDiGraph by default for multiple edges."""
        if multi:
            G = nx.MultiDiGraph()
            for node in self.nodes:
                G.add_node(node)
            for tx in self.transactions:
                G.add_edge(tx['sender'], tx['receiver'], amount=tx['amount'], timestamp=tx['timestamp'])
        else:
            G = nx.DiGraph()
            for node in self.nodes:
                G.add_node(node)
            for tx in self.transactions:
                u, v, amount = tx['sender'], tx['receiver'], tx['amount']
                if G.has_edge(u, v):
                    G[u][v]['amount'] += amount
                    G[u][v]['count'] += 1
                else:
                    G.add_edge(u, v, amount=amount, count=1)
        return G
