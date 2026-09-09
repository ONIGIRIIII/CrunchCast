# Model evaluation report
Read this alongside data/README.md, which explains that difficulty_score is a proxy built from grade outcomes, not a direct measurement of student workload.

## Setup
- Train: offerings through 2013W (session_order <= 4027), 99,483 rows.
- Test: offerings from 2014S through 2016W (strictly out-of-time), 19,024 rows.
- Boosting rounds (223) chosen by early stopping on an inner validation slice (2012S-2013W), never on the test set itself.
- The model actually shipped in the API is refit on ALL available data (1996-2016) using the same config; see model/train.py's module docstring for why, and note that this means the numbers below are a lower bound on the shipped model's real quality, not a direct score of it.

## Headline metrics (difficulty_score, 0-100 scale)
| Model | MAE | RMSE | R2 |
|---|---|---|---|
| Heuristic baseline (historical lookup, no ML) | 12.64 | 17.10 | 0.651 |
| LightGBM | 12.13 | 16.20 | 0.688 |

LightGBM reduces MAE by 4.1% versus the heuristic baseline, i.e. it's better than just looking up a course's own trailing history, but not by a huge margin. That's expected: most of the signal in this proxy label IS a course/subject's own history, so a big jump over that baseline would be more suspicious than reassuring.

## Feature importance (gain, top 10)
                       feature         gain  gain_pct
   hist_course_mean_difficulty 3.998114e+08 70.383769
  hist_subject_mean_difficulty 6.373949e+07 11.220856
                       subject 3.541646e+07  6.234801
                  course_level 3.046747e+07  5.363568
hist_professor_mean_difficulty 1.628995e+07  2.867722
     hist_course_mean_enrolled 1.295089e+07  2.279906
   hist_course_offerings_count 4.341906e+06  0.764360
  hist_subject_offerings_count 2.026250e+06  0.356706
global_running_mean_difficulty 1.294000e+06  0.227799
hist_professor_offerings_count 1.030656e+06  0.181439

## Error by subject (min 20 test rows)
### Hardest to predict
         mean_abs_error  count
subject                       
FNIS          21.511601     23
ADHE          20.955047    104
FIST          20.349539     46
SCIE          20.003290     83
GRSJ          19.218817    109
FIPR          18.949689     48
ELEC          18.750057    144
ARCL          18.727125     41
VISA          17.999014    152
GERM          17.741335    220

### Easiest to predict
         mean_abs_error  count
subject                       
PHTH           4.462873     58
RSOT           4.477579     35
BAHR           4.635669     61
AUDI           5.047422    145
BAMA           5.398961     66
PLAN           5.445907     85
BASM           5.835850     44
EDCP           6.207409    167
EDST           6.276646    162
NURS           6.338446    223

## Error by course level
                   mean  count
course_level                  
0             14.166043      9
100           12.499950   3294
200           13.156069   3065
300           12.563907   5064
400           13.858271   3919
500            8.475886   3609
600            8.132810     64

## Worst 15 individual predictions
 year session subject course section  difficulty_score  pred_lightgbm  pred_baseline  abs_error_lgbm  hist_course_offerings_count
 2014       W    CRWR    501     D01         93.537934       1.005809       0.790671       92.532126                            5
 2016       W    ENGL    553     001         92.987756       8.962702       8.068428       84.025054                           23
 2015       W    LLED    572     061         87.712962       5.125749       7.153973       82.587213                           12
 2016       W    EECE    549     101         98.043154      15.500964      12.247462       82.542189                           10
 2015       W    POLI    514     001         94.328605      13.523115      11.998869       80.805490                            4
 2014       W    MATH    538     201         94.675420      14.151836      17.270288       80.523584                            2
 2016       W    CRWR    416     002         88.901078       9.370238       8.151101       79.530839                            4
 2016       W    POLI    540     001         90.940620      11.467838       5.921029       79.472781                            3
 2015       S    ETEC    540     66B         89.582894      10.139080      13.592716       79.443813                           25
 2014       S    ECED    531     97A         84.073515       4.752080       1.906217       79.321434                            1
 2014       W    EPSE    411     074         92.087387      12.781779      15.462747       79.305608                           16
 2015       W    MATH    255     104         11.032260      89.882053      89.343518       78.849793                           96
 2015       W    PHIL    530     001         93.180994      14.650782      16.997871       78.530211                            6
 2015       W    ETEC    540     64B         91.714413      14.487931      16.076969       77.226482                           27
 2015       W    GEOG    545     101         91.457045      14.680061      11.598471       76.776983                            2

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
