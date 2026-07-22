import networkx as nx
from typing import Dict, Any
from utils.graph import TransactionGraph

def detect_communities(graph: TransactionGraph) -> Dict[str, Any]:
    """Detect communities using Louvain, Label Propagation, and Girvan-Newman."""
    G = graph.to_networkx(multi=False).to_undirected()
    
    results = {
        "louvain": {},
        "label_propagation": {},
        "girvan_newman": []
    }
    
    if not G.nodes:
        return results
        
    try:
        from networkx.algorithms.community import louvain_communities
        communities = louvain_communities(G)
        for i, comm in enumerate(communities):
            for node in comm:
                results["louvain"][node] = i
    except Exception:
        pass
        
    try:
        from networkx.algorithms.community import label_propagation_communities
        communities = list(label_propagation_communities(G))
        for i, comm in enumerate(communities):
            for node in comm:
                results["label_propagation"][node] = i
    except Exception:
        pass
        
    # Girvan-Newman is expensive, only top level
    try:
        from networkx.algorithms.community import girvan_newman
        comp = next(girvan_newman(G))
        for i, comm in enumerate(comp):
            for node in comm:
                results["girvan_newman"].append({"node": node, "community": i})
    except Exception:
        pass
        
    return results
