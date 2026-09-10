# Model evaluation report
Read this alongside data/README.md, which explains that difficulty_score is a proxy built from grade outcomes, not a direct measurement of student workload.

## Setup
- Train: offerings through 2013W (session_order <= 4027), 99,483 rows.
- Test: offerings from 2014S through 2016W (strictly out-of-time), 19,024 rows.
- Boosting rounds (296) chosen by early stopping on an inner validation slice (2012S-2013W), never on the test set itself.
- The model actually shipped in the API is refit on ALL available data (1996-2016) using the same config; see model/train.py's module docstring for why, and note that this means the numbers below are a lower bound on the shipped model's real quality, not a direct score of it.

## Headline metrics (difficulty_score, 0-100 scale)
| Model | MAE | RMSE | R2 |
|---|---|---|---|
| Heuristic baseline (historical lookup, no ML) | 12.64 | 17.10 | 0.651 |
| XGBoost | 12.27 | 16.33 | 0.682 |

XGBoost reduces MAE by 2.9% versus the heuristic baseline, i.e. it's better than just looking up a course's own trailing history, but not by a huge margin. That's expected: most of the signal in this proxy label IS a course/subject's own history, so a big jump over that baseline would be more suspicious than reassuring.

## Feature importance (gain, top 10)
                       feature          gain  gain_pct
   hist_course_mean_difficulty 361423.187500 54.621510
  hist_subject_mean_difficulty 126794.968750 19.162392
                  course_level  96729.132812 14.618573
hist_professor_mean_difficulty  20191.884766  3.051579
                       subject  18708.138672  2.827342
     hist_course_mean_enrolled  15102.118164  2.282367
   hist_course_offerings_count   6408.267090  0.968475
                       session   5816.152832  0.878989
  hist_subject_offerings_count   3003.284424  0.453883
hist_professor_offerings_count   2868.355957  0.433492

## Error by subject (min 20 test rows)
### Hardest to predict
         mean_abs_error  count
subject                       
FNIS          22.146662     23
ADHE          20.672759    104
GRSJ          20.489400    109
GPP           20.384953     22
FIST          20.296181     46
SCIE          19.784337     83
ELEC          19.094157    144
ARCL          18.621019     41
VISA          18.130238    152
GERM          18.016907    220

### Easiest to predict
         mean_abs_error  count
subject                       
RSOT           4.376814     35
PHTH           4.492789     58
BAHR           4.989616     61
AUDI           5.215708    145
PLAN           5.481477     85
BAMA           5.740113     66
BASM           5.919848     44
NURS           6.130425    223
EDST           6.447475    162
EDCP           6.539984    167

## Error by course level
                   mean  count
course_level                  
0             14.047984      9
100           12.662222   3294
200           13.373742   3065
300           12.689860   5064
400           13.918723   3919
500            8.659192   3609
600            8.563287     64

## Worst 15 individual predictions
 year session subject course section  difficulty_score  pred_xgboost  pred_baseline  abs_error_xgb  hist_course_offerings_count
 2014       W    CRWR    501     D01         93.537934      2.100347       0.790671      91.437587                            5
 2016       W    ENGL    553     001         92.987756      8.922335       8.068428      84.065421                           23
 2016       W    EECE    549     101         98.043154     16.004707      12.247462      82.038446                           10
 2015       W    LLED    572     061         87.712962      6.970264       7.153973      80.742698                           12
 2015       S    ETEC    540     66B         89.582894      9.627972      13.592716      79.954922                           25
 2014       S    ECED    531     97A         84.073515      4.551906       1.906217      79.521609                            1
 2015       W    MATH    255     104         11.032260     90.386528      89.343518      79.354268                           96
 2014       W    MATH    538     201         94.675420     15.367414      17.270288      79.308006                            2
 2015       W    PHIL    530     001         93.180994     14.159557      16.997871      79.021436                            6
 2016       W    CRWR    416     002         88.901078      9.950319       8.151101      78.950758                            4
 2015       W    POLI    514     001         94.328605     16.312395      11.998869      78.016210                            4
 2016       W    POLI    540     001         90.940620     13.228949       5.921029      77.711671                            3
 2014       W    EPSE    411     074         92.087387     14.468123      15.462747      77.619264                           16
 2015       W    ETEC    540     64B         91.714413     14.458491      16.076969      77.255922                           27
 2014       S    FNLG    480     001         82.680348      7.237868       8.986389      75.442480                            4

## Error analysis notes
- Courses/subjects with few historical offerings (low `hist_course_offerings_count`) tend to have the largest errors, since the model falls back to a coarser subject-level or global estimate. This is visible in the worst-predictions table above.
- Because difficulty_score is percentile-ranked over the WHOLE corpus, it is a relative measure: a difficulty_score of 80 means 'harder than about 80% of historical offerings in this dataset,' not an absolute workload amount.
- Small-enrollment sections were already excluded upstream (enrolled < 10, see data/README.md), so remaining errors are not primarily a small-sample-size artifact at the row level, though they can still be at the course level for rarely-offered courses.
- Graduate-level (500/600) courses have the LOWEST mean absolute error on average (see 'Error by course level'), but several of the single worst individual predictions are also graduate courses. The likely reason: grad cohorts are small and tightly graded (most students cluster near the top of the scale), so a single unusual offering can swing the percentile-ranked difficulty_score from near 0 to near 100 with almost no change in the raw average grade. The model, trained on that course's typically-calm history, has no way to see that coming. This is a real limitation of the proxy label's sensitivity for small, homogeneous cohorts, not a generic ML failure.

## Limitations (see also top-level README)
- **Proxy label, not workload.** difficulty_score reflects grade outcomes (avg, fail rate, grade spread), which correlate with but are not the same thing as how much work a course actually takes. A generously-graded but time-consuming course would score as 'easy' here.
- **Grade data reliability window.** Only 2016W and earlier PAIR data is used; anything about 2017+ trends (curriculum changes, grading policy shifts, new instructors) is invisible to this model, and predictions for the current catalog are extrapolations from up to a decade of historical drift.
- **Professor feature is sparse.** About half of rows have no usable professor-level history (name inconsistency across years); the model can't use instructor identity as a reliable signal for most courses.
- **No real section-timing/workload signal at all** (e.g. reading load, assignment frequency, project-based vs. exam-based grading) exists in this data source; the model is limited to what grade distributions can tell us.
