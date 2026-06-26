import re

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add to main.py -> generate_descriptive_chart
qq_pp_code = """                elif chart_type == 'qqplot':
                    import scipy.stats as stats
                    (osm, osr), (slope, intercept, r) = stats.probplot(df_clean[col_x], dist="norm")
                    fig = px.scatter(x=osm, y=osr, title=f"Q-Q Plot de {col_x}", labels={"x": "Quantiles Théoriques Normaux", "y": "Valeurs Observées (Triées)"})
                    fig.add_trace(go.Scatter(x=osm, y=osm*slope + intercept, mode="lines", name="Ligne de référence", line=dict(color="red", dash="dash")))
                    fig.update_layout(showlegend=False)
                elif chart_type == 'ppplot':
                    import scipy.stats as stats
                    import numpy as np
                    # Calculate empirical cdf
                    sorted_x = np.sort(df_clean[col_x])
                    n = len(sorted_x)
                    yvals = np.arange(1, n+1) / n
                    # Calculate theoretical cdf
                    mean, std = np.mean(sorted_x), np.std(sorted_x)
                    theoretical_cdf = stats.norm.cdf(sorted_x, loc=mean, scale=std)
                    fig = px.scatter(x=theoretical_cdf, y=yvals, title=f"P-P Plot de {col_x}", labels={"x": "Probabilités Théoriques (Normale)", "y": "Probabilités Empiriques"})
                    fig.add_trace(go.Scatter(x=[0, 1], y=[0, 1], mode="lines", name="Ligne de référence", line=dict(color="red", dash="dash")))
                    fig.update_layout(showlegend=False)
"""

content = content.replace("elif chart_type == 'histogram':", qq_pp_code + "                elif chart_type == 'histogram':")

with open("main.py", "w", encoding="utf-8") as f:
    f.write(content)
