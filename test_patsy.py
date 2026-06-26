import pandas as pd
import statsmodels.api as sm
from statsmodels.formula.api import ols

df = pd.DataFrame({
    'col_y_abc': [1,2,3,4,5,6],
    'col_x_def': ['A','A','B','B','A','B'],
    'col_c_ghi': ['X','Y','X','Y','Y','X']
})

formula = "Q('col_y_abc') ~ C(Q('col_x_def')) + C(Q('col_c_ghi')) + C(Q('col_x_def')):C(Q('col_c_ghi'))"
model = ols(formula, data=df).fit()
anova_table = sm.stats.anova_lm(model, typ=2)
print("SUCCESS!")
print(anova_table.index)
print("P-value:", anova_table.loc["C(Q('col_x_def')):C(Q('col_c_ghi'))", 'PR(>F)'])
