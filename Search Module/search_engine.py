import unicodedata

def remove_accents(s: str):
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()

def match_score(query, name):
    q = remove_accents(query.lower().strip())
    n = remove_accents(name.lower().strip())

    q_words = q.split()
    n_words = n.split()

    # 1. Match hoàn hảo
    if q == n:
        return 1000
    
    # 2. Match theo thứ tự nhưng không cần liền nhau (subsequence)
    j = 0
    for word in n_words:
        if word.startswith(q_words[j]):
            j += 1
            if j == len(q_words):
                return 900  # match thành công

    return 0
